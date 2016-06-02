/// <reference path="lib/collections.ts"/>
/// <reference path="lib/node.d.ts"/>
/// <reference path="lib/heap.d.ts"/>

/** Graph module
*
*  Types for generic A\* implementation.
*/

/** An edge in a graph. */
class Edge<Node> {
    from: Node;
    to: Node;
    cost: number;
}

/** A directed graph. */
interface Graph<Node> {
    /** Computes the edges that leave from a node. */
    outgoingEdges(node: Node): Edge<Node>[];
    /** A function that compares nodes. */
    compareNodes: collections.ICompareFunction<Node>;
}

/** Type that reports the result of a search. */
class SearchResult<Node> {
    /** The path (sequence of Nodes) found by the search algorithm. */
    path: Node[];
    /** The total cost of the path. */
    cost: number;
}

/** Type stored in the priority queue. Keeps track of its parent
    in order to reconstruct the path. */
class QueueNode<Node> {
    public toString(): string {
        return "poop";
    }

    parent: QueueNode<Node>;
    node: Node;
    cost: number;
    heuristic: number;
}


/**
* An implementation of the A* search algorithm using a priority queue.
* @param graph The graph on which to perform A\* search.
* @param start The initial node.
* @param goal A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
* @param heuristics The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
* @param timeout Maximum time (in seconds) to spend performing A\* search.
* @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
*/

function aStarSearchOriginal<Node>(graph: Graph<Node>,
    start: Node,
    goal: (n: Node) => boolean,
    heuristics: (n: Node) => number,
    timeout: number): SearchResult<Node> {

    //Used to check for timeout (timeout : number)
    var startTime: number = Date.now();

    // Priority queue for keeping track of paths to the nodes in the graph
    var queue = new collections.PriorityQueue<QueueNode<Node>>(
        // The comparator function
        function (Object1, Object2) {
            return (Object2.cost + Object2.heuristic) -
                (Object1.cost + Object1.heuristic)
        }
    );

    // Initiate the result to an empty path and zero cost
    var result: SearchResult<Node> = { path: [], cost: 0 };

    //Initial queue edges
    var startNode: QueueNode<Node> = {
        parent: undefined,
        node: start,
        cost: 0,
        heuristic: heuristics(start)
    };
    queue.enqueue(startNode);

    // Used to store nodes to which the shortest path has already been found
    // Uses as binary search tree to be able to find if nodes are in the set
    // in O(log n)
    var closedSet: collections.BSTree<Node> = new collections.BSTree<Node>(graph.compareNodes);

    //Iteration
    while ((Date.now() - startTime < (timeout * 1000)) && (!queue.isEmpty())) {

        // First element in priority queue
        var current: QueueNode<Node> = queue.dequeue();
        closedSet.add(current.node);

        // Goal found, reconstruct path
        if (goal(current.node)) {
            var prev: QueueNode<Node> = current;
            result.cost += current.cost;
            result.path.push(current.node);
            while (prev.parent != undefined) {
                prev = prev.parent;
                //console.log(prev.node.toString());
                result.path.push(prev.node);
            }
            // Saves about 0.0000000000000001 s over using unshift. 
            result.path.reverse();
            return result;
        }

        //Add neighbouring edges to queue
        var adjEdges: Edge<Node>[] = graph.outgoingEdges(current.node);
        for (var edge of adjEdges) {

            // Neater code with these predefined!
            var targetNode: Node = edge.to;
            var shorterPathExists: boolean = false;
            var accumCost = edge.cost + current.cost;

            // We do not have to look in the queue at all if the node already is in the closed set
            if (!closedSet.contains(targetNode)) {

                // It could be costly to calculate heuristics, so only do it once
                var currHeur = heuristics(targetNode);

                // Look if the target node is in the set, with a lower cost, by comparing with all
                // nodes in the queue. If Node had a unique toString or implemented HashCode this
                // could have been done in O(1), and updating a node could be done in O(log n), and
                // would also save further computation time since the queue would not have several 
                // entries for the same node with varying paths
                queue.forEach(function (searchNode) {
                    if (graph.compareNodes(searchNode.node, targetNode) == 0) {

                        // Only continue for the correct node. Use the already calculated heuristic value
                        // to save computations
                        if ((accumCost + currHeur) >= (searchNode.cost + currHeur)) {
                            shorterPathExists = true;

                            // It is only safe to break the iteration if we have found a path in the queue
                            // with lower cost than the current path. There could be several paths in the queue
                            // and we cannot break if we have only found a path with higher cost.
                            return false;
                        }
                    }
                    return true; // Fix compiler warning
                });

                // If there is no shorter path in the queue, add the newly found one
                if (!shorterPathExists) {
                    var newNode: QueueNode<Node> = {
                        parent: current,
                        node: targetNode,
                        cost: accumCost,
                        heuristic: currHeur
                    };
                    queue.enqueue(newNode);
                }
            }
        }
    }

    // Return result, which can be empty
    return result;
}

function aStarSearch<Node>(graph: Graph<Node>,
    start: Node,
    goal: (n: Node) => boolean,
    heuristics: (n: Node) => number,
    timeout: number): SearchResult<Node> {
    return aStar.anytimeAStarRepairing(graph, start, goal, heuristics, timeout);
}

module aStar {
    var graph: Graph<Node>;
    var start: Node;
    var goal: (n: Node) => boolean;
    var heuristics: (n: Node) => number;

    // Keep track of nodes that have been visited globally
    var visitedSet: { [node: string]: QueueNode<Node>; } = {};
    var inconsistentSet: { [node: string]: QueueNode<Node>; } = {};

    // Priority queue for keeping track of paths to the nodes in the graph
    var queue: collections.PriorityQueue<QueueNode<Node>>;

    // Initial value for epsilon
    var epsilon: number = 4;

    // Comparator for priority queue
    function nodeComparator<Node>(node1: QueueNode<Node>, node2: QueueNode<Node>){
        return (node2.cost + epsilon * node2.heuristic - node1.cost + epsilon * node1.heuristic);
    };
    
    export function anytimeAStarRepairing<Node>(graph: Graph<Node>,
        start: Node,
        goal: (n: Node) => boolean,
        heuristics: (n: Node) => number,
        timeout: number): SearchResult<Node> {

        console.log("aStarSearch med hash");

        // Staring factor to heuristic function
        var currEpsilon: number;

        // Used to check for timeout
        var timeoutTime: number = Date.now() + timeout * 1000;

        queue = new collections.PriorityQueue<QueueNode<Node>>(nodeComparator);

        // Initial queue edges
        var startNode: QueueNode<Node> = {
            parent: undefined,
            node: start,
            cost: 0,
            heuristic: heuristics(start)
        };
        queue.add(startNode);
        console.log("startNode: " + startNode.toString());
        console.log("startNode.node: " + startNode.node.toString());

        var result: SearchResult<Node>;

        result = improvePath();

        console.log("Got result! " + result.cost);
        return result;

        /*currEpsilon = Math.min(epsilon, result.cost);
    
        // Iteration
        while ((Date.now() < timeoutTime) && (!queue.isEmpty())) {
            var inconsistentSet: { [node: string]: QueueNode<Node> };
        }
        // Return empty result*/
    }
    function improvePath<Node>() {

        console.log("Entering improvePath");
        // Used to store nodes to which the shortest path has already been found
        // Hashmap for O(1) retrieval
        var closedSet: { [node: string]: QueueNode<Node>; } = {};
        while (!queue.isEmpty()) {
            // First element in priority queue
            var current: QueueNode<Node> = queue.dequeue();
            closedSet[current.node.toString()] = current;
            console.log("Closed set: " + Object.keys(closedSet).length);
            console.log("Visited set: " + Object.keys(visitedSet).length);
            console.log("Inconsistent set: " + Object.keys(inconsistentSet).length);
            // Goal found, reconstruct path
            if (goal(current.node)) {
                return calculatePath(current);
            }
            //Add neighbouring edges to queue
            var adjEdges: Edge<Node>[] = graph.outgoingEdges(current.node);
            for (var edge of adjEdges) {
                // Neater code with these predefined
                var targetNode: Node = edge.to;
                var targetQueueNode: QueueNode<Node>;
                var shorterPathExists: boolean = false;
                var accumCost: number = edge.cost + current.cost;
                console.log("TargetNode: " + targetNode.toString());
                console.log(targetNode.toString());

                // It could be costly to calculate heuristics, so only do it once
                var currHeur = heuristics(targetNode);

                // Has targetNode been visited before?
                targetQueueNode = visitedSet[targetNode.toString()];
                if (!(targetQueueNode === undefined)) {
                    console.log("targetQueueNode not undefined");
                    // Have we found a faster path than is already known?
                    if (targetQueueNode.cost > accumCost) {
                        console.log("Cost not higher");
                        targetQueueNode.parent = current;
                        targetQueueNode.cost = accumCost;
                        targetQueueNode.heuristic = currHeur;

                        // Is the node not closed?
                        if (closedSet[targetNode.toString()] === undefined) {
                            console.log("targetNode not in closed set");
                            // If not in the closed set, and has been visited, 
                            // it has to be in the queue, so update it. We already
                            // know that the currently found path is faster.
                            queue.enqueue(targetQueueNode);
                        } else {
                            // If it has been visited, but is in the closed set, 
                            // we insert it into the inconsistent set. 
                            console.log("targetNode added to inconsistent");
                            inconsistentSet[targetNode.toString()] = targetQueueNode;
                        }
                    }
                } else {
                    console.log("targetNode undefined");
                    var newNode: QueueNode<Node> = {
                        parent: current,
                        node: targetNode,
                        cost: accumCost,
                        heuristic: currHeur
                    };
                    queue.add(newNode);
                    visitedSet[targetNode.toString()] = newNode;
                    console.log("set targetNode to visited");
                    console.log("targetNode: " + targetNode.toString());
                    console.log("newNode: " + newNode.toString());
                    console.log("newNode.node: " + newNode.node.toString());
                    console.log("visitedSet: " + visitedSet);
                }
            }
        }
        return new SearchResult<Node>();
    }

    function calculatePath<Node>(goal: QueueNode<Node>): SearchResult<Node> {
        var prev: QueueNode<Node> = goal;

        // Initiate the result to an empty path and zero cost
        var result: SearchResult<Node> = { path: [], cost: 0 };

        result.cost += goal.cost;
        result.path.push(goal.node);
        while (prev.parent != undefined) {
            prev = prev.parent;
            result.path.push(prev.node);
        }
        // Saves about 0.0000000000000001 s over using unshift. 
        result.path.reverse();
        return result;
    }
}