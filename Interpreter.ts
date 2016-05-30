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
                var destEnts : string[] = getEntities(cmd.location.entity, state);

                // The case where there's a triple relation
                if(cmd.location.entity2 != null){
                    var destEnts2 : string[] = getEntities(cmd.location.entity2, state);

                    ents.forEach((ent) => {
                        var obj = getWorldObject(ent, state);
                        for(var i = 0; i < destEnts.length && i < destEnts2.length; i++){
                            var destObj1 = getWorldObject(destEnts[i], state);
                            var destObj2 = getWorldObject(destEnts2[i], state);
                            if (constraintsTriple(obj, destObj1, destObj2, cmd.location.relation)){
                                interpretations.push([{polarity: true, 
                                    relation: cmd.location.relation, 
                                    args: [ent, destEnts[i], destEnts2[i]]}]);
                            }
                        }
                    });
                } else {
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
                }
                break;
            case "put":
                if(state.holding == null)
                    break;

                var obj = getWorldObject(state.holding, state);
                var destEnts = getEntities(cmd.location.entity, state);
                // The case where there's a triple relation
                if(cmd.location.entity2 != null){
                    var destEnts2 : string[] = getEntities(cmd.location.entity2, state);
                    for(var i = 0; i < destEnts.length && i < destEnts2.length; i++){
                        var destObj1 = getWorldObject(destEnts[i], state);
                        var destObj2 = getWorldObject(destEnts2[i], state);
                        if (constraintsTriple(obj, destObj1, destObj2, cmd.location.relation)){
                            interpretations.push([{polarity: true, 
                                relation: cmd.location.relation, 
                                args: [state.holding, destEnts[i], destEnts2[i]]}]);
                        }
                    }
                } else {
                    destEnts.forEach((destEnt) => {
                        var destObj = getWorldObject(destEnt, state);

                        if (constraints(obj, destObj, cmd.location.relation)){
                            interpretations.push([{polarity: true, 
                                relation: cmd.location.relation, 
                                args: [state.holding, destEnt]}]);
                        }
                    });
                }
                break;
            case "where":
            case "exist":
                // Handles the cases of where and exists, questions from the user
                var ents : string[] = getEntities(cmd.entity, state);
                var result : string = "";
                if(ents.length > 1 && cmd.command == "exists"){
                    alert("Yes, several objects fitting the description exists");
                } else if(ents.length > 1 && cmd.command == "where"){
                    alert("Found several objects with that description!");
                } else if(ents.length == 0){
                    alert("Object could not be found!");
                } else if (cmd.command == "exist") {
                    var obj : ObjectDefinition = getWorldObject(ents[0], state);
                    result = ("Yes, a " + obj.size + " " + obj.color + " " + obj.form + " exists.");
                    alert(result);
                } else if (cmd.command == "where"){
                    var index = getIndex(ents[0], state);
                    if(index != null){
                        var obj : ObjectDefinition = getWorldObject(ents[0], state);
                        var objDescr : string = ("A " + obj.size + " " + obj.color + " " + obj.form);
                        result = (objDescr + " is located in column " + index.x + ", at height " + index.y + ".");
                        alert(result);
                    }
                }
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
        return result;
    }

    function getObjects(obj : Parser.Object, state : WorldState) : string[] {
        if(obj.location == null){
            return withDescription(obj, state);
        }else if(obj.location.relation == "between"){
            var result : string[] = locationCheckTriple(getObjects(obj.object, state), 
                obj.location.relation, getEntities(obj.location.entity, state), 
                getEntities(obj.location.entity2, state), state);
            return result;
        } else {
            var result : string[] = locationCheck(getObjects(obj.object, state), 
                obj.location.relation, getEntities(obj.location.entity, state), state);
            return result;
        }
    }

    /** In addition to locationCheck to handle triple relations. */
    function locationCheckTriple(objectStrings : string[], relation : string, locObjStrings1 : string[], 
        locObjStrings2 : string[], state : WorldState): string[] {
        var result : string[] = [];

        objectStrings.forEach((objStr) => {

            locObjStrings1.forEach((locStr1) => {
                locObjStrings2.forEach((locStr2) => {
                    if(relationCheckTriple(objStr, locStr1, locStr2, relation, state)) {
                        if(result.indexOf(objStr) == -1){
                            result.push(objStr);
                        } 
                    }
                });
            });
        });
        return result;
    }

    function locationCheck(objectStrings : string[], relation : string, locObjStrings : string[], state : WorldState): string[] {
        var result : string[] = [];

        objectStrings.forEach((objStr) => {

            locObjStrings.forEach((locStr) => {
                if(relationCheck(objStr, locStr, relation, state)) {
                    if(result.indexOf(objStr) == -1){
                        result.push(objStr);
                    } 
                }
            });
        });
        return result;
    }

    /** Returns the string representation of all objects in the world. */
    function getObjectStrings (state : WorldState) : string[] {
        var objectStrings : string[] = Array.prototype.concat.apply([], state.stacks);
        if(state.holding != null)
            objectStrings.push(state.holding);
        objectStrings.push("floor");
        return objectStrings;
    }

    export function getWorldObject (objectString : string, state : WorldState) : ObjectDefinition {
        var objects = state.objects;
        // Adds the floor to the list of objects
        if(objectString == "floor")
            return { "form":"floor",   "size":"",  "color":"" };
        else
            return objects[objectString];
    }

    /** Finds objects matching another objects description. */
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

    /** In addition to relationCheck to handle triple relations. */
    export function relationCheckTriple(obj1 : string, obj2 : string, obj3 : string, relation : string, state : WorldState) : boolean {
        if(obj1 == obj3 || obj1 == obj2 || obj2 == obj3){
            return false;
        }
        if(obj1 == "floor" || obj2 == "floor" || obj3 == "floor")
            return false;

        var obj1X : number;
        var obj2X : number;
        var obj3X : number;
        var obj1Y : number;
        var obj2Y : number;
        var obj3Y : number;

        if(getIndex(obj1, state) != null){
            obj1X = getIndex(obj1, state).x;
            obj1Y = getIndex(obj1, state).y;
        } else {
            return false;
        }

        if(getIndex(obj2, state) != null){
            obj2X = getIndex(obj2, state).x;
            obj2Y = getIndex(obj2, state).y;
        } else {
            return false;
        }

        if(getIndex(obj3, state) != null){
            obj3X = getIndex(obj3, state).x;
            obj3Y = getIndex(obj3, state).y;
        } else {
            return false;
        }

        switch(relation){
            case "between":
                return ((obj1X > obj2X && obj1X < obj3X) ||
                    (obj1X < obj2X && obj1X > obj3X));
            default:
                return false;
        }
    }
    /** Checks if the relation of two objects holds. */
    export function relationCheck (obj1 : string, obj2 : string, relation : string, state : WorldState) : boolean {
        if(obj1 == obj2){
            return false;
        }

        if(obj1 == "floor")
            return false;

        var obj1X : number;
        var obj2X : number;
        var obj1Y : number;
        var obj2Y : number;

        if(getIndex(obj1, state) != null){
            obj1X = getIndex(obj1, state).x;
            obj1Y = getIndex(obj1, state).y;
        } else {
            return false;
        }

        if(obj2 == "floor"){
            obj2Y = -1;
            obj2X = obj1X;
        } else if(getIndex(obj2, state) != null){
            obj2X = getIndex(obj2, state).x;
            obj2Y = getIndex(obj2, state).y;
        } else {
            return false;
        }

        // Compares indices depending on the relation
        switch(relation){
            case "inside":
                return constraints(getWorldObject(obj1,state), 
                    getWorldObject(obj2, state), "inside") && obj1X == obj2X && 
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
            case "under":
                return obj1X == obj2X && obj1Y < obj2Y;
            default:
                return false;
        }
    }

    class Index {
        constructor(
            public x : number,
            public y : number
        ){}
    }

    /** Find the index of an object in a world */
    function getIndex(object : string, state : WorldState) : Index {
        for(var x : number = 0; x < state.stacks.length; x++){
            for(var y : number = 0; y < state.stacks[x].length; y++){
                if(state.stacks[x][y] == object){
                    return new Index(x, y);
                }
            }
        }
        return null;
    }

    function fitsDescription(objectDef : Parser.Object, color : string, size : string, form : string): boolean {
        return (objectDef.form == form || form == "anyform") &&
            (objectDef.size == size || size == null) &&
            (objectDef.color == color || color == null);
    }

    export function constraints (obj1 : Parser.Object, obj2 : Parser.Object, relation : string) : boolean {
        if(obj1.form == "floor")
            return false;

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

                // a box can not be put ontop of a box
                if(obj1.form == "box" && obj2.form == "box")
                    return false;

                // cant put a large table ontop some small objects
                if(obj1.size == "large" && obj2.size == "small"){
                    return !(obj1.form == "table" && (obj2.form == "box" 
                        || obj2.form == "brick" || obj2.form == "pyramid"));

                // cant put a small object ontop a large box
                } else if(obj1.size == "small" && obj2.size == "large" && obj2.form == "box"){
                    return false;

                // only certain objects can be placed ontop of a large box
                } else if(obj1.size == "large" && obj2.size == "large" && obj2.form == "box"){
                    return obj1.form != "table" && obj1.form != "plank" && obj1.form != "pyramid";

                } else {
                    return true;
                }
            case "above":
                if(obj2.form == "ball") return false;
                return true;
            case "under":
                if(obj1.form == "ball") return false;
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

    /** In addition to constrains to handle triple relations. */
    export function constraintsTriple (obj1 : Parser.Object, obj2 : Parser.Object, 
        obj3 : Parser.Object, relation : string) : boolean {
        if(obj1.form == "floor")
            return false;

        // shouldnt be needed, check elsewhere
        if(obj1 == obj3 || obj1 == obj2 || obj2 == obj3)
            return false;

        switch(relation) {
            case "between":
                return obj1 != "floor" && obj2 != "floor" && obj3 != "floor";
            default:
                break;
        }
        return false;
    }
}
