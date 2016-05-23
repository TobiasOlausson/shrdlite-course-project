///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Graph.ts"/>

/** 
* Planner module
*
* The goal of the Planner module is to take the interpetation(s)
* produced by the Interpreter module and to plan a sequence of actions
* for the robot to put the world into a state compatible with the
* user's command, i.e. to achieve what the user wanted.
*/
module Planner {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    /**
     * Top-level driver for the Planner. Calls `planInterpretation` for each given interpretation generated by the Interpreter. 
     * @param interpretations List of possible interpretations.
     * @param currentState The current state of the world.
     * @returns Augments Interpreter.InterpretationResult with a plan represented by a list of strings.
     */
    export function plan(interpretations : Interpreter.InterpretationResult[], currentState : WorldState) : PlannerResult[] {
        var errors : Error[] = [];
        var plans : PlannerResult[] = [];
        interpretations.forEach((interpretation) => {
            try {
                var result : PlannerResult = <PlannerResult>interpretation;
                result.plan = planInterpretation(result.interpretation, currentState);
                // result.plan.push("new interpretation");
                // result.plan.push(toString(result.interpretation));

                if (result.plan.length == 0) {
                    result.plan.push("That is already true!");
                }
                plans.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (plans.length) {
            return plans;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface PlannerResult extends Interpreter.InterpretationResult {
        plan : string[];
    }

    export function stringify(result : PlannerResult) : string {
        return result.plan.join(", ");
    }

    //////////////////////////////////////////////////////////////////////
    // private functions

    /**
     * @param interpretation The logical interpretation of the user's desired goal. The plan needs to be such that by executing it, the world is put into a state that satisfies this goal.
     * @param state The current world state.
     * @returns Basically, a plan is a
     * stack of strings, which are either system utterances that
     * explain what the robot is doing (e.g. "Moving left") or actual
     * actions for the robot to perform, encoded as "l", "r", "p", or
     * "d".
     */

     var objects : {[s:string]: ObjectDefinition;} = null;
     var interpretation : Interpreter.DNFFormula = null;
     var initialWorld : WorldState = null;

    function planInterpretation(interpret : Interpreter.DNFFormula, state : WorldState) : string[] {
        var timeout : number = 10000;

        var plan : string[] = [];
        var cloneState : WorldState = clone(state);
        initialWorld = state;

        objects = cloneState.objects;
        interpretation = interpret;

        var startState : State = new State(cloneState.stacks, cloneState.holding, cloneState.arm, null);

        var path = aStarSearch(new StateGraph(), startState, isGoal, heuristics, timeout);
        path.path.forEach((s) => {
            if(s.action != null)
                plan.push(s.action);
        });

        return plan;
    }

    function heuristics(state : State) : number {
        var result : number = 0;
        var numAbove : number = 0;
        var armDist : number = 0;
        interpretation.forEach((conj) => {
            conj.forEach((literal) =>{

                if(isGoal(state)){
                    result = 0;
                    return;
                }
                switch(literal.relation){
                    case "holding":
                        numAbove = objectsAbove(literal.args[0], state);
                        armDist = armDistance(literal.args[0], state);
                        result = armDist + numAbove*4 + 1;
                        return;
                    case "ontop":
                    case "inside":
                        var numAbove1 = objectsAbove(literal.args[0], state);
                        var numAbove2 = objectsAbove(literal.args[1], state);
                        var armDist1 = armDistance(literal.args[0], state);
                        var armDist2 = armDistance(literal.args[1], state);
                        var nearest : number = 0;

                        if(numAbove1 == 0 && numAbove2 > 0){
                            nearest = armDist2;
                        }else if(numAbove2 == 0 && numAbove1 > 0){
                            nearest = armDist1;
                        }else if(numAbove1 == 0 && numAbove2 ==0){
                            nearest = armDist1;
                        }else{
                            nearest = Math.min(armDist1, armDist2); 
                        }

                        var dist : number = distBetween(literal.args[0], literal.args[1], state);

                        result = nearest + dist + (numAbove1 + numAbove2)*3 + 2 ;

                        if((numAbove2 > 0) && state.holding != null){
                            result += 1;
                        }
                        return;
                    case "above":
                        numAbove = objectsAbove(literal.args[0], state);

                        var armDist1 = armDistance(literal.args[0], state);
                        var armDist2 = armDistance(literal.args[1], state);
                        var dist : number = distBetween(literal.args[0], literal.args[1], state);
                        var nearest : number = Math.min(armDist1, armDist2);

                        result = numAbove*4 + dist + nearest;
                        return;

                    case "leftof":
                    case "rightof":
                    case "beside":
                        var dist : number = distBetween(literal.args[0], literal.args[1], state) -1;
                        numAbove = objectsAbove(literal.args[0], state);
                        armDist = armDistance(literal.args[0], state);
                        result = numAbove*4 + dist + armDist;
                        return;

                    default: 
                        result = 0;
                        return;

                }
            });
        });
        return result;
    }

    function distBetween(object1 : string, object2 : string, state: State) : number{
        var index1 : number = -1;
        var index2 : number = -1;
        var result : number = 0;
        state.stacks.forEach((stack) => {
            if(stack.indexOf(object1) != -1){
                index1 = state.stacks.indexOf(stack);
            }
            if(stack.indexOf(object2) != -1){
                index2 = state.stacks.indexOf(stack);
            }
            if(index1 != -1 && index2 != -1){
                return;
            }
        });
        if(index1 == -1){ // the arm is holding object 1
            result = armDistance(object2, state);
        }else if (index2 == -1){ // the arm is holding object 2
            result = armDistance(object1, state);
        }else{ // both objects are in stacks
            result = Math.abs(index1 - index2);
        }
        return result;

    }

    function armDistance(object : string, state: State) : number {
        var result : number = 0;
        state.stacks.forEach((stack) => {
            if(stack.indexOf(object) != -1){
                result = Math.abs(state.arm - state.stacks.indexOf(stack));
                return;
            }
        });
        return result;

    }

    function objectsAbove(object : string, state : State) : number {
        var result : number = 0;
        var index : number = -1;
        state.stacks.forEach((stack) => {
            index = stack.indexOf(object);
            if (index != -1){
                result = (stack.length-1) - index;
                return;
            }
        });
        return result;

    }

    function isGoal(state : State) : boolean {
        var res = interpretation.some(function (interp) {
            return interp.every(function (literal) {
                switch(literal.relation){
                    case "holding":
                        return (literal.args[0] == state.holding);
                    case "inside":
                    case "above":
                    case "beside":
                    case "leftof":
                    case "rightof":
                    case "ontop":
                        var worldState : WorldState = clone(initialWorld);
                        worldState.arm = state.arm;
                        worldState.stacks = state.stacks;
                        worldState.holding = state.holding;
                        worldState.objects = objects;

                        return Interpreter.relationCheck(literal.args[0], 
                            literal.args[1], literal.relation, worldState);
                    default:
                        return false;
                }
            });
        });
        return res;
    }

    class State {

        constructor(
            public stacks : Stack[], 
            public holding : string, 
            public arm: number, 
            public action :string
        ){}



        toString() : string {
            return ("Arm: " + this.arm + 
            " | Holding: " + this.holding + 
            " | Action: " + this.action + 
            " | Stacks: " +
            this.stacks[0] +":"+
            this.stacks[1] +":"+
            this.stacks[2] +":"+
            this.stacks[3] +":"+
            this.stacks[4]);
        }
    }

    class StateGraph implements Graph<State> {

        constructor(){}

        /** Computes the edges that leave from a state. */
        outgoingEdges(state : State) : Edge<State>[] {
            var edges : Edge<State>[] = [];
            ["l", "r", "p", "d"].forEach((action) => {
                var nextState : State = getNextState(action, state);
                if(nextState != null){
                    edges.push({
                        from: state,
                        to: nextState,
                        cost: 1
                    });
                }
            });

            return edges;
        }

        /** A function that compares states. */
        compareNodes (stateA : State, stateB : State) : number {
            var equalStacks : boolean = stateA.stacks == stateB.stacks;
            var equalHolding : boolean = stateA.holding == stateB.holding;
            var equalArms : boolean = stateA.arm == stateB.arm;
            var equalActions : boolean = stateA.action == stateB.action;
            if(equalStacks && equalHolding && equalArms && equalActions){
                return 0;
            }else{
                return 1;
            }
        }
    }

    function getNextState(action : string, state : State) : State {
        var newState = clone(state);
        
        switch(action){
            case "l":
                if(state.arm > 0){
                    return new State(newState.stacks, newState.holding, newState.arm - 1, action);
                }
                break;
            case "r":
                if(state.arm < state.stacks.length - 1){
                    return new State(newState.stacks, newState.holding, newState.arm + 1, action);
                }
                break;
            case "p":
                if(state.holding == null){
                    var x = newState.arm;

                    if(newState.stacks[x].length > 0){
                        var tmp = newState.stacks[x].pop();
                        return new State(newState.stacks, tmp, newState.arm, action);
                    }
                }
                break;
            case "d":
                if(state.holding != null){
                    // state of the arm
                    var x = newState.arm;
                    // length of the stack at arms position
                    var length = newState.stacks[x].length;
                    // y value of the object to be checked at stack x
                    var y = length - 1;

                    if(length > 0){
                        var below : string = newState.stacks[x][y];
                        var belowObject : Parser.Object = objects[below];
                        var ontopObject : Parser.Object = objects[newState.holding];

                        if(Interpreter.constraints(ontopObject, belowObject, "ontop")
                            || Interpreter.constraints(ontopObject, belowObject, "inside")){
                            newState.stacks[x].push(newState.holding);
                            newState.holding = null;
                            newState.action = action;
                            return newState;
                        }
                    } else {
                        newState.stacks[x].push(newState.holding);
                        newState.holding = null;
                        newState.action = action;

                        return newState;
                    }


                }
                break;
            default:
                break;
        }
        return null;
    }

    function clone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }
}
