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
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     */
    
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {            
        var interpretations : DNFFormula = [];

        switch(cmd.command){
            case "take":
                var ents : string[]= getEntities(cmd.entity, state);
                ents.forEach((objStr) => {
                    interpretations.push([{polarity: true, relation: "holding", args: [objStr]}]);
                });
                break;
            case "move":
                var objects = state.objects;
                var ents : string[] = getEntities(cmd.entity, state);
                var destEnts = getEntities(cmd.location.entity, state);
                ents.forEach((ent) => {
                    destEnts.forEach((destEnt) => {
                        var obj = objects[ent];
                        var destObj = objects[destEnt];

                        if (constraints(obj, destObj, cmd.location.relation, state)){

                            interpretations.push([{polarity: true, relation: cmd.location.relation, args: [ent, destEnt]}]);
                        }
                    });
                });
                break;
            case "put":
                if(state.holding == null)
                    break;

                break;
            default:
                break;
            }
        // console.log("about to return " + interpretations[s0][0]);
        if(interpretations[0] == null) 
            return null;

        return interpretations;
    }

    function getEntities(entity : Parser.Entity, state: WorldState) : string[]{ 

        //TODO handle quantifiers
        var result : string[] = getObjects(entity.object, state);
        console.log("getEntities just got from getObjects: " + result);
        return result;
    }
    function getObjects(obj : Parser.Object, state : WorldState) : string[] {
        if(obj.location == null){
            return withDescription(obj, state);
        }else{
            console.log("about to call locationCheck");
            var result : string[] = locationCheck(getObjects(obj.object, state), obj.location.relation, getEntities(obj.location.entity, state), state);
            console.log("just got from locationCheck: " + result);
            return result;
        }
    }

    function locationCheck(objectStrings : string[], relation : string, locObjStrings : string[], state : WorldState): string[] {
        console.log("at start of locationCheck");
        var result : string[] = [];
        var objects = state.objects;
        console.log(objectStrings + " " + relation + " " +  locObjStrings);
        objectStrings.forEach((objStr) => {
                var objDef = objects[objStr];

                locObjStrings.forEach((locStr) => {
                    var locObj = objects[locStr]
                    if(relationCheck(objDef, locObj, relation, state)) {
                        if(result.indexOf(objStr) == -1){
                            result.push(objStr);
                        } 
                    }
                });
            });
        return result;
    }

    function withDescription(obj : Parser.Object, state : WorldState) : string[] {

        // console.log("in withDescription");

        // if(obj.location != null){
        //     console.log("in withDescription with non null location");
        //     return [];
        // }else{
        var objects = state.objects;

        var result : string[] = [];
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);

        objectStrings.forEach((objStr) => {
            var objDef = objects[objStr];
            
            if(fitsDescription(objDef, obj.color, obj.size, obj.form)) {
                result.push(objStr);
            }
        });

        return result;
        // }
    }

    function relationCheck (obj1 : Parser.Object, obj2 : Parser.Object, relation : string, state : WorldState) : boolean {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        if(obj1 == obj2){
            return false;
        }
        // if(obj1 == "floor") return false;

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

        if(relation == "inside"){
            return constraints(obj1, obj2, "inside", state) && indexX == sndIndexX && 
                indexY == sndIndexY + 1;
        }

        if(relation == "ontop") return indexX == sndIndexX && indexY == sndIndexY - 1;
        if(relation == "above") return indexX == sndIndexX && indexY < sndIndexY;

        if(relation == "beside") return indexX == sndIndexX + 1 || indexX == sndIndexX - 1;
        if(relation == "leftof") return indexX < sndIndexX;
        if(relation == "rightof") return indexX > sndIndexX;
        
        return false;
    }

    function fitsDescription(objectDef : Parser.Object, color : string, size : string, form : string): boolean {        
        return (objectDef.form == form || form == "anyform") &&
            (objectDef.size == size || size == null) &&
            (objectDef.color == color || color == null);
    }

    function constraints (obj1 : Parser.Object, obj2 : Parser.Object, relation : string, state : WorldState) : boolean {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        var objects = state.objects;

        // console.log("constraint test:");
        // console.log("specs obj1: " + obj1.color + " " + obj1.form + " " + obj1.size);
        // console.log("specs obj2: " + obj2.color + " " + obj2.form + " " + obj2.size);

        if(obj1 == obj2){
            return false;
        }
        if(obj1 == "floor") return false;

        if(relation == "inside"){
            if(obj2.form != "box"){ 
                return false;
            }else if(obj1.form == "box"){
                return (obj1.size == "small" && obj2.size == "large");
            }else {
                if(obj1.size == "large") 
                    return obj2.size == "large";
                return true;
            }
        }
        if(relation == "ontop"){
            if(obj1.form == "ball" && obj2.form == "floor") return true;
            if(obj1.form == "box" && obj2.form == "table") return true;
            return false;
        }
        if(relation == "above"){
            if(obj2.form == "ball") return false;
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
}