///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="lib/collections.ts"/>

/**
* Interpreter module
* 
* The goal of the Interpreter module is to interpret a sentence
* written by the user in the context of the current world state. In
* particular, it must figure out which objects in the world,
* i.e. which elements in the `objects` field of WorldState, correspond
* to the ones referred to in the sentence. 
*
* Moreover, it has to derive what the intended goal state is and
* return it as a logical formula described in terms of literals, where
* each literal represents a relation among objects that should
* hold. For example, assuming a world state where "a" is a ball and
* "b" is a table, the command "put the ball on the table" can be
* interpreted as the literal ontop(a,b). More complex goals can be
* written using conjunctions and disjunctions of these literals.
*
* In general, the module can take a list of possible parses and return
* a list of possible interpretations, but the code to handle this has
* already been written for you. The only part you need to implement is
* the core interpretation function, namely `interpretCommand`, which produces a
* single interpretation for a single command.
*/
module Interpreter {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

/**
Top-level function for the Interpreter. It calls `interpretCommand` for each possible parse of the command. No need to change this one.
* @param parses List of parses produced by the Parser.
* @param currentState The current state of the world.
* @returns Augments ParseResult with a list of interpretations. Each interpretation is represented by a list of Literals.
*/    
    export function interpret(parses : Parser.ParseResult[], currentState : WorldState) : InterpretationResult[] {
        var errors : Error[] = [];
        var interpretations : InterpretationResult[] = [];
        parses.forEach((parseresult) => {
            try {
                var result : InterpretationResult = <InterpretationResult>parseresult;
                result.interpretation = interpretCommand(result.parse, currentState);
                interpretations.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (interpretations.length) {
            return interpretations;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface InterpretationResult extends Parser.ParseResult {
        interpretation : DNFFormula;
    }

    export type DNFFormula = Conjunction[];
    type Conjunction = Literal[];

    /**
    * A Literal represents a relation that is intended to
    * hold among some objects.
    */
    export interface Literal {
    /** Whether this literal asserts the relation should hold
     * (true polarity) or not (false polarity). For example, we
     * can specify that "a" should *not* be on top of "b" by the
     * literal {polarity: false, relation: "ontop", args:
     * ["a","b"]}.
     */
        polarity : boolean;
    /** The name of the relation in question. */
        relation : string;
    /** The arguments to the relation. Usually these will be either objects 
     * or special strings such as "floor" or "floor-N" (where N is a column) */
        args : string[];
    }

    export function stringify(result : InterpretationResult) : string {
        return result.interpretation.map((literals) => {
            return literals.map((lit) => stringifyLiteral(lit)).join(" & ");
            // return literals.map(stringifyLiteral).join(" & ");
        }).join(" | ");
    }

    export function stringifyLiteral(lit : Literal) : string {
        return (lit.polarity ? "" : "-") + lit.relation + "(" + lit.args.join(",") + ")";
    }

    //////////////////////////////////////////////////////////////////////
    // private functions
    /**
     * The core interpretation function. The code here is just a
     * template; you should rewrite this function entirely. In this
     * template, the code produces a dummy interpretation which is not
     * connected to `cmd`, but your version of the function should
     * analyse cmd in order to figure out what interpretation to
     * return.
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     */
    
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {            
        var interpretations : DNFFormula = [];

        switch(cmd.command){
            case "take":
                getTakeObjects(cmd.entity, state).forEach((objStr) => {
                    interpretations.push([{polarity: true, relation: "holding", args: [objStr]}]);
                });
                break;
            case "move":
                // interpretations.concat(getMoveInterpretations(cmd.entity, state));
                break;
            case "put":
                if(state.holding == null)
                    break;

                break;
            default:
                break;
            }

        return interpretations;
    }

    function getTakeObjects(entity : Parser.Entity, state : WorldState) : string[] {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        var result : string[] = [];
        var subjects : string[] = [];

        objectStrings.forEach((objStr) => {
            var objDef = objects[objStr];

            if(fitsDescription(objDef, entity.object.color, entity.object.size, entity.object.form)) {
                subjects.push(objStr);
            }
        });

        if(entity.object.location == null){
            return subjects;
        } else {            
            var validObjects : string[] = [];
            objectStrings.forEach((objStr) => {
                var objDef = objects[objStr];
                
                if(fitsDescription(objDef, entity.object.object.color, 
                    entity.object.object.size, entity.object.object.form)) {
                    validObjects.push(objStr);
                }
            });
            validObjects.forEach((objStr) => {
                if(isValidTakeObject(objects[objStr], entity.object, state))
                    result.push(objStr);
            });
            return result;
        }
    }

    function isValidTakeObject(mainObj : Parser.Object, obj : Parser.Object, state : WorldState) : boolean {
        if(obj.location == null)
            return true;

        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        var validObjects : string[] = [];
        objectStrings.forEach((objStr) => {
            var objDef = objects[objStr];
            
            if(fitsDescription(objDef, obj.location.entity.object.color, obj.location.entity.object.size, 
                obj.location.entity.object.form)) {
                if(constraintsTake(mainObj, objDef, obj.location.relation, state)){
                    validObjects.push(objStr);
                }
            }
        });

        //not sure if it works properly...
        var isValid : boolean = true;
        validObjects.forEach((x) => {
            isValid = isValid && isValidTakeObject(objects[x], obj.location.entity.object, state);
        });
        return validObjects.length != 0 && isValid;
    }

    function constraintsTake (obj1 : Parser.Object, obj2 : Parser.Object, relation : string, state : WorldState) : boolean {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        if(obj1 == obj2){
            return false;
        }
        if(obj1 == "floor") return false;

        var indexX : number = -2;
        var sndIndexX : number = -2;
        var indexY : number = -2;
        var sndIndexY : number = -2;
        for(var x : number = 0; x < state.stacks.length; x++){
            for(var y : number = 0; y < state.stacks[x].length; y++){
                if(objects[state.stacks[x][y]] == obj2){
                    sndIndexX = x;
                    sndIndexY = y;
                }

                if(objects[state.stacks[x][y]] == obj1){
                    indexX = x;
                    indexY = y;
                }
            }
        }
        // meh, fix relations...
        if(relation == "inside"){
            // if(indexX == sndIndexX && indexY == sndIndexY + 1){
            //     if(!(obj2.form == "box" && (obj1.form == "ball" || obj1.form == "box")))
            //         return true;
            //     if(obj1.size == "large" && obj2.size == "large")
            //         return true;
            //     return true;
            // } else {
            //     return false;
            // }
        }
        if(relation == "ontop"){
            return false;
        }
        if(relation == "above"){
            return true;
        }

        if(relation == "beside") return indexX == sndIndexX + 1 || indexX == sndIndexX -1;
        if(relation == "leftof") return indexX == sndIndexX -1;
        if(relation == "rightof") return indexX == sndIndexX +1;
        
        return false;
    }

    function fitsDescription(objectDef : ObjectDefinition, color : string, size : string, form : string): boolean {        
        return (objectDef.form == form || form == "anyform") &&
            (objectDef.size == size || size == null) &&
            (objectDef.color == color || color == null);
    }



    // old stuff...




    function solve(obj : Parser.Object, objStr : string, loc : Parser.Location, state : WorldState) : DNFFormula {
        var result : DNFFormula = [];

        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        switch(loc.relation) {
            case "inside":
            case "ontop":
                var list : string[] = getValidObjects(obj, loc.entity.object, state, loc.relation);
                if(list.length == 0){
                    break;
                }

                list.forEach((listItem) => {
                    if(solveRest(loc.entity.object, loc.entity.object.location, state)){
                        result.push([{polarity: true, relation: loc.relation, args: [objStr, listItem]}]);
                    }
                }); 

                break;
            case "above":
                var list : string[] = getValidObjects(obj, loc.entity.object, state, "above");
                if(list.length == 0){
                    break;
                }

                list.forEach((listItem) => {
                    if(solveRest(loc.entity.object, loc.entity.object.location, state)){
                        result.push([{polarity: true, relation: "above", args: [objStr, listItem]}]);
                    }
                });
                break;
            case "leftof":
            case "rightof":
            case "beside":
                var list : string[] = getValidObjects(obj, loc.entity.object, state, loc.relation);
                if(list.length == 0){
                    break;
                }

                list.forEach((listItem) => {
                    if(solveRest(loc.entity.object, loc.entity.object.location, state)){
                        result.push([{polarity: true, relation: loc.relation, args: [objStr, listItem]}]);
                    }
                });
                break;
            case "under":
                break;
            default:
                break;
        }
        if(result.length == 0) return null;
        return result;
    }

    function solveRest(obj : Parser.Object, loc : Parser.Location, state : WorldState) : boolean {
        if(loc == null || obj == null) return true;
        var list : string[] = getValidObjects(obj, loc, state, loc.relation);
        return list.length != 0 && solveRest(loc.entity.object, loc.entity.object.location, state);
    }

    function getValidObjects(obj : Parser.Object, target : Parser.Object, state : WorldState, relation : string) : string[] {

        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        var validObjects : string[] = [];
        objectStrings.forEach((objStr) => {
            var objDef = objects[objStr];
            
            if(fitsDescription(objDef, target.color, target.size, target.form)) {
                if(constraints(obj, objDef, relation, state)){
                    validObjects.push(objStr);
                }
            }
        });

        return validObjects;
    }


    function constraints (obj1 : Parser.Object, obj2 : Parser.Object, relation : string, state : WorldState) : boolean {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        if(obj1 == obj2){
            return false;
        }
        if(obj1 == "floor") return false;

        if(relation == "inside"){
            if(!(obj1.form == "ball" && obj2.form == "box")) return false;
            if(obj1.size == "large") return obj2.size == "large";
            return true;
        }
        if(relation == "ontop"){
            if(obj1.form == "ball" && obj2.form == "floor") return true;
            if(obj1.form == "box" && obj2.form == "table") return true;
            return false;
        }
        if(relation == "above"){
            if(obj2.form == "ball") return false;
            // if(obj1.form == "box" && obj2.form == "ball") return true;
            // if(obj1.form == "table" && obj2.form == "ball") return true;
            return true;
        }
        if(relation == "leftof"){
            return true;
        } 
        if(relation == "rightof"){
            return true;
        }
        if(relation == "beside"){
            return true;
        }
        return false;
    }

    // function getValidTakeObjects(obj : Parser.Object, state : WorldState, relation : string) : string[] {
    //     var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
    //     var objects = state.objects;

    //     var validObjects : string[] = [];
    //     objectStrings.forEach((objStr) => {
    //         var objDef = objects[objStr];
            
    //         if(fitsDescription(objDef, obj.object.color, obj.object.size, obj.object.form)) {
    //             // console.log("objDef: " + objDef.color + " " + objDef.size + " " + objDef.form);
    //             // console.log("target: " + target.color + " " + target.size + " " + target.form);
    //             if(constraintsTake(obj.object, objDef, object.location.relation, state)){
    //                 validObjects.push(objStr);
    //             }
    //         }
    //     });

    //     return validObjects;
    // }


}