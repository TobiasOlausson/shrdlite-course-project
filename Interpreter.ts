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
                var intprt = interpretCommand(result.parse, currentState);
                if(intprt != null){
                    result.interpretation = intprt;
                    interpretations.push(result);
                }
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
     * @throws An error when no valid interpretations can be found
     */
    
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {            
        var interpretations : DNFFormula = [];
        switch(cmd.command){
            case "take":
                var ents : string[] = getEntities(cmd.entity, state);
                ents.forEach((objStr) => {
                    if(objStr != "floor")
                        interpretations.push([{polarity: true, relation: "holding", 
                            args: [objStr]}]);
                });
                break;
            case "move":
                var ents : string[] = getEntities(cmd.entity, state);
                var destEnts = getEntities(cmd.location.entity, state);
                ents.forEach((ent) => {
                    var obj = getWorldObject(ent, state);

                    destEnts.forEach((destEnt) => {
                        var destObj = getWorldObject(destEnt, state);

                        if (constraints(obj, destObj, cmd.location.relation)){
                            interpretations.push([{polarity: true, 
                                relation: cmd.location.relation, 
                                args: [ent, destEnt]}]);
                        }
                    });
                });
                break;
            case "put":
                if(state.holding == null)
                    break;

                var obj = getWorldObject(state.holding, state);
                var destEnts = getEntities(cmd.location.entity, state);
                destEnts.forEach((destEnt) => {
                    var destObj = getWorldObject(destEnt, state);

                    if (constraints(obj, destObj, cmd.location.relation)){
                        interpretations.push([{polarity: true, 
                            relation: cmd.location.relation, 
                            args: [state.holding, destEnt]}]);
                    }
                });
                break;
            default:
                break;
            }
        if(interpretations.length == 0) 
            return null;
        return interpretations;
    }

    function getEntities(entity : Parser.Entity, state: WorldState) : string[]{ 

        //TODO handle quantifiers
        var result : string[] = getObjects(entity.object, state);
        // console.log("getEntities just got from getObjects: " + result);
        return result;
    }
    function getObjects(obj : Parser.Object, state : WorldState) : string[] {
        if(obj.location == null){
            return withDescription(obj, state);
        }else{
            // console.log("about to call locationCheck");
            var result : string[] = locationCheck(getObjects(obj.object, state), obj.location.relation, getEntities(obj.location.entity, state), state);
            // console.log("just got from locationCheck: " + result);
            return result;
        }
    }

    function locationCheck(objectStrings : string[], relation : string, locObjStrings : string[], state : WorldState): string[] {
        // console.log("at start of locationCheck");
        var result : string[] = [];

        objectStrings.forEach((objStr) => {
                var objDef = getWorldObject(objStr, state);

                locObjStrings.forEach((locStr) => {
                    var locObj = getWorldObject(locStr, state);

                    if(relationCheck(objDef, locObj, relation, state)) {
                        if(result.indexOf(objStr) == -1){
                            result.push(objStr);
                        } 
                    }
                });
            });
        return result;
    }

    function getObjectStrings (state : WorldState) : string[] {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);

        objectStrings.push("floor");
        return objectStrings;
    }

    function getWorldObject (objectString : string, state : WorldState) : ObjectDefinition {
        var objects = state.objects;

        if(objectString == "floor")
            return { "form":"floor",   "size":"",  "color":"" };
        else
            return objects[objectString];
    }

    function withDescription(obj : Parser.Object, state : WorldState) : string[] {
        var result : string[] = [];
        var objectStrings : string[] = getObjectStrings(state);

        objectStrings.forEach((objStr) => {
            var objDef = getWorldObject(objStr, state);
            
            if(fitsDescription(objDef, obj.color, obj.size, obj.form)) {
                result.push(objStr);
            }
        });

        return result;
    }

    function relationCheck (obj1 : Parser.Object, obj2 : Parser.Object, relation : string, state : WorldState) : boolean {
        var objects = state.objects;

        if(obj1 == obj2){
            return false;
        }

        if(obj1.form == "floor") return false;

        var obj1X : number = Infinity;
        var obj2X : number = Infinity;
        var obj1Y : number = Infinity;
        var obj2Y : number = Infinity;
        // find indices of obj1 and obj2
        for(var x : number = 0; x < state.stacks.length; x++){
            for(var y : number = 0; y < state.stacks[x].length; y++){
                if(objects[state.stacks[x][y]] == obj2){
                    obj2X = x;
                    obj2Y = y;
                }

                if(objects[state.stacks[x][y]] == obj1){
                    obj1X = x;
                    obj1Y = y;
                }
            }
        }
        if(obj2.form == "floor"){
            obj2Y = -1;
            obj2X = obj1X;
        }
        // no objects were found
        if(obj1Y == Infinity || obj2Y == Infinity)
            return false;

        switch(relation){
            case "inside":
                return constraints(obj1, obj2, "inside") && obj1X == obj2X && 
                    obj1Y == obj2Y + 1;
            case "ontop":
                return obj1X == obj2X && obj1Y == obj2Y + 1;
            case "above":
                return obj1X == obj2X && obj1Y > obj2Y;
            case "beside":
                return obj1X == obj2X + 1 || obj1X == obj2X - 1;
            case "leftof":
                return obj1X < obj2X;
            case "rightof":
                return obj1X > obj2X;
            default:
                return false;
        }
    }

    function fitsDescription(objectDef : Parser.Object, color : string, size : string, form : string): boolean {
        return (objectDef.form == form || form == "anyform") &&
            (objectDef.size == size || size == null) &&
            (objectDef.color == color || color == null);
    }

    export function constraints (obj1 : Parser.Object, obj2 : Parser.Object, relation : string) : boolean {
        // console.log("constraints with obj1: " + obj1.form + " obj2: " + obj2.form);
        if(obj1.form == "floor") return false;

        // shouldnt be needed, check elsewhere
        if(obj1 == obj2)
            return false;

        switch(relation) {
            case "inside":
                // An object can only be placed inside of a box
                // Only a number of small objects can be placed in a small box
                // and certain small objects cant be placed inside a large box
                // all other cases are true
                if(obj2.form != "box")
                    return false;
                if(obj2.size == "small"){
                    return obj1.size == "small" && 
                        (obj1.form == "ball" || obj1.form == "brick" 
                            || obj1.form == "table");
                } else {
                    return obj1.size == "small" || 
                        (obj1.form != "pyramid" && obj1.form != "box" 
                            && obj1.form != "plank");
                }
            // special cases for ball and box
            case "ontop":
                // cant place objects on balls
                if(obj2.form == "ball")
                    return false;

                // a ball can only be placed on the floor
                if(obj1.form == "ball"){
                    return obj2.form == "floor";
                }

                if(obj2.size == "small"){
                    if(obj1.size == "small")
                        return !(obj1.form == "ball" && obj2.form == "box");
                    else
                        return !(obj1.form == "table" && 
                            (obj2.form == "box" || 
                                obj2.form == "brick" || 
                                obj2.form == "pyramid"));
                } else {
                    if(obj2.form == "box"){
                        if(obj1.size == "small")
                            return false;
                        else
                            return obj1.form != "table" && obj1.form != "plank" 
                                && obj1.form != "pyramid";
                    }
                    return true;
                }
            case "above":
                if(obj2.form == "ball") return false;
                return true;
            case "leftof":
            case "rightof":
            case "beside":
                return true;
            default:
                break;
        }
        return false;
    }
}
