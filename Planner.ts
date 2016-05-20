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
                result.plan.push("new interpretation");
                result.plan.push(toString(result.interpretation));
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
    function planInterpretation(interpretation : Interpreter.DNFFormula, state : WorldState) : string[] {
        var timeout : number = 1000;

        var objects = state.objects;

        var plan : string[] = [];

        // heuristics
        // getHeuristics();

        // define a goal state
        // var goal = ;

        // create graph
        //  - neighbour function
        //  - compare function

        // start state
        var startState : State = new State(state.stacks, state.holding, state.arm, null);

        // A* planner (graph, start, goal, heuristics, timeout)
        // var path = aStarSearch(null, start, isGoal, heuristics, timeout);

        return plan;
    }

    function heuristics(state : WorldState) : number {
        return 0;
    }

    function isGoal(state : WorldState, interpretation : Interpreter.DNFFormula) : boolean {
        var res = interpretation.some(function (interp) {
            return interp.every(function (literal) {
                if(literal.relation == "holding"){
                    return (literal.args[0] == state.holding);
                }else{
                    //TODO probably call relationcheck 
                    return true;
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

    }

    class StateGraph implements Graph<State> {

        constructor(start : State){}

        /** Computes the edges that leave from a state. */
        outgoingEdges(state : State) : Edge<State>[] {
            var edges : Edge<State>[] = [];

            ["l", "r", "p", "d"].forEach((action) => {
                var nextState : State = getNextState(action, state);
                if(nextState != null)
                    edges.push({
                        from: state,
                        to: nextState,
                        cost: 1
                    });
            });

            return edges;
        }

        /** A function that compares states. */
        //collections.ICompareFunction<WorldState>
        compareNodes (stateA : State, stateB : State) : number {
            var equalStacks : boolean = stateA.stacks == stateB.stacks;
            var equalHolding : boolean = stateA.holding == stateB.holding;
            var equalArms : boolean = stateA.arm == stateB.arm;
            var equalActions : boolean = stateA.action == stateB.action;
            if(equalStacks && equalHolding && equalArms && equalActions){
                return 1;
            }else{
                return 0;
            }
        }
    }

    function getNextState(action : string, state : State) : State {
        switch(action){
            case "l":
                if(state.arm > 0){
                    return new State(state.stacks, state.holding, state.arm - 1, action);
                }
                break;
            case "r":
                if(state.arm < state.stacks.length){
                    return new State(state.stacks, state.holding, state.arm + 1, action);
                }
                break;
            case "p":
                if(state.holding == null){
                    var tmp = state.stacks[state.arm].pop();
                    return new State(state.stacks, tmp, state.arm, action);
                }
                break;
            case "d":
                break;
            default:
                break;
        }
        return null;
    }

    function toString(interpretation : Interpreter.DNFFormula) : string{
        var result : string = "";

        for(var i = 0; i < interpretation.length; i++){
            for(var j = 0; j < interpretation[i].length; j++){
                result = result.concat(interpretation[i][j].relation + "(");
                for(var k = 0; k < interpretation[i][j].args.length; k++){
                    result = result.concat(interpretation[i][j].args[k]);
                    if(k + 1  < interpretation[i][j].args.length)
                        result = result.concat(", ");
                }
                result = result.concat(")    ")
            }
        }
        return result;
    }

}
