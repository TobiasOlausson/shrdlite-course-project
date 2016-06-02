/// <reference path="lib/collections.ts"/>

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
    parent: QueueNode<Node>;
    node: Node;
    cost: number;
    heuristic: number;
}



/* Regular aStar not used, but left in the code to be able to be inspected */
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

/**
* An implementation of the A* search algorithm using a priority queue.
* @param graph The graph on which to perform A\* search.
* @param start The initial node.
* @param goal A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
* @param heuristics The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
* @param timeout Maximum time (in seconds) to spend performing A\* search.
* @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
*/

function aStarSearch<Node>(graph: Graph<Node>,
    start: Node,
    goal: (n: Node) => boolean,
    heuristics: (n: Node) => number,
    timeout: number): SearchResult<Node> {
    var astar: aStar<Node> = new aStar<Node>(graph, start, goal, heuristics, timeout);
    return astar.anytimeAStarRepairing(timeout);
}

class aStar<Node> {
    private graph: Graph<Node>;
    private start: Node;
    private goal: (n: Node) => boolean;
    private heuristics: (n: Node) => number;

    // Keep track of nodes that have been visited globally
    private visitedSet: { [node: string]: QueueNode<Node>; } = {};
    private inconsistentSet: { [node: string]: QueueNode<Node>; } = {};

    // Priority queue for keeping track of paths to the nodes in the graph
    private queue: collections.PriorityQueue<QueueNode<Node>>;

    // Initial value for epsilon. Chosen by empirical testing in shrdlite
    private epsilon: number = 4;

    // Known goal state with lowest path to it
    private goalState: QueueNode<Node>;

    constructor(
        graph: Graph<Node>,
        start: Node,
        goal: (n: Node) => boolean,
        heuristics: (n: Node) => number,
        timeout: number) {

        this.graph = graph;
        this.start = start;
        this.goal = goal;
        this.heuristics = heuristics;
    }
    
    public anytimeAStarRepairing(timeout: number): SearchResult<Node> {
        // Used to check for timeout
        var timeoutTime: number = Date.now() + timeout;

        function nodeComparator(node1: QueueNode<Node>, node2: QueueNode<Node>) {
            return ((node2.cost + node2.heuristic) - (node1.cost + node1.heuristic));
        };

        this.queue = new collections.PriorityQueue<QueueNode<Node>>(nodeComparator);

        // Initial queue edges
        var startNode: QueueNode<Node> = {
            parent: undefined,
            node: this.start,
            cost: 0,
            heuristic: this.epsilon * this.heuristics(this.start) //this this this
        };
        this.queue.add(startNode);
        
        // Keep track of current search result
        var result: SearchResult<Node>;

        // Calculate a path
        result = this.improvePath();

        // Keep track of historical costs; not needed for algorithm; only used to see
        // how the algorithm improves the path
        var results: number[] = [result.cost];

        // Keep track of how good the current solution is
        var currEpsilon: number = this.epsilon;

        // Create a new queue for open nodes (since collections.PriorityQueue do not have a method
        // for resorting a queue when an element is changed.
        // Note that the comparator is the same since it uses the precomputed value for the
        // heuristic function as stored in the QueueNodes.
        var iterQueue: collections.PriorityQueue<QueueNode<Node>>;

        // Continue improving the path until we 1) run out of time, 2) have an optimal solution (-0.0001 is to 
        // correct rounding errors) or 3) don't have any more nodes to explore.
        while (Date.now() < timeoutTime) {

            // Find the lowest calculated cost in the open and inconsistent set. Has to be lower than
            // the result so far.
            var minCost: number = result.cost;

            var queueArray: QueueNode<Node>[] = this.queue.toArray();
            for (var node of queueArray) {
                minCost = Math.min(minCost, node.cost + node.heuristic / this.epsilon);
            }
            for (var key in this.inconsistentSet) {
                // This is O(1) under optimal conditions, so no added time complexity)
                var node: QueueNode<Node> = this.inconsistentSet[key];
                minCost = Math.min(minCost, node.cost + node.heuristic / this.epsilon);
                queueArray.push(node);
            }

            // Calculate the bound for the current solution. If the start is at the solution
            // result.cost will be zero, and the empty path will be returned
            if (minCost > 0) {
                currEpsilon = Math.min(this.epsilon, result.cost / minCost);
            } else {
                currEpsilon = this.epsilon;
            }

            // The subtraction is to account for rounding errors in the calculation
            // of currEpsilon
            if ((currEpsilon - 0.0001 < 1) || (result.cost == 0)) {
                console.log("Current found solution is optimal!");
                console.log("All found solution costs: " + results);
                return result;
            }

            var oldEpsilon = this.epsilon;
            this.epsilon = Math.max(1, this.epsilon - 1);
            var epsilonDiv = this.epsilon / oldEpsilon;

            // Replace the old queue with the new one, including inconsistent nodes and with updated
            // heuristic values.
            iterQueue = new collections.PriorityQueue<QueueNode<Node>>(nodeComparator);
            
            // Update the old queue and inconsistent set with new heuristics, and add them to the new queue
            // to get them in the right order. With an updateable queue this could have been done more 
            // efficiently with a .heapify() function or similar after updating the old queue. That way
            // we would not have to had go through all nodes twice; one to calculate minCost and once to 
            // add to the new queue.
            queueArray.concat(queueArray);
            for (node of queueArray) {
                node.heuristic = node.heuristic * epsilonDiv;
                iterQueue.enqueue(node);
            }
            this.queue = iterQueue;
            // Since all inconsistent nodes have been added to the new queue, clear the inconsistent set
            this.inconsistentSet = {};

            // Improve the path and save the result
            result = this.improvePath();
            results.push(result.cost);
        }
        // Return non-optimal (if currEpsilon was never 1, or timeout) or empty result
        console.log("Timeout occured. Returning last found solution.");
        console.log("Optimal solution has to cost at least " + result.cost / currEpsilon + ".");
        console.log("All found solution costs: " + results);
        return result;
    }
    private improvePath(): SearchResult<Node>{

        // Used to store nodes to which the shortest path has already been found
        var closedSet: { [node: string]: QueueNode<Node>; } = {};

        while (!this.queue.isEmpty()) {
            // First element in priority queue
            var current: QueueNode<Node> = this.queue.dequeue();
            closedSet[current.node.toString()] = current;

            // Goal found, reconstruct path
            if (this.goal(current.node)) {
                if ((this.goalState === undefined) || (this.goalState.cost > current.cost)) {
                    this.goalState = current;
                }
                return this.calculatePath(this.goalState);
            }
            //Add neighbouring edges to queue
            var adjEdges: Edge<Node>[] = this.graph.outgoingEdges(current.node);
            for (var edge of adjEdges) {
                // Neater code with these predefined
                var targetNode: Node = edge.to;
                var targetQueueNode: QueueNode<Node>;
                var shorterPathExists: boolean = false;
                var accumCost: number = edge.cost + current.cost;

                // It could be costly to calculate heuristics, so only do it once
                var currHeur = this.heuristics(targetNode)*this.epsilon;
                // Has targetNode been visited before?
                targetQueueNode = this.visitedSet[targetNode.toString()];
                if (!(targetQueueNode === undefined)) {

                    // Have we found a faster path than is already known?
                    if (targetQueueNode.cost > accumCost) {
                        targetQueueNode.parent = current;
                        targetQueueNode.cost = accumCost;
                        targetQueueNode.heuristic = currHeur;

                        // Is the node not closed?
                        if (closedSet[targetNode.toString()] === undefined) {
                            // If not in the closed set, and has been visited, 
                            // it has to be in the queue, so update it. We already
                            // know that the currently found path is faster.
                            this.queue.enqueue(targetQueueNode);
                        } else {
                            // If it has been visited, but is in the closed set, 
                            // we insert it into the inconsistent set. 
                            this.inconsistentSet[targetNode.toString()] = targetQueueNode;
                        }
                    }
                } else {
                    // If we have not visited the node, add it to the queue
                    var newNode: QueueNode<Node> = {
                        parent: current,
                        node: targetNode,
                        cost: accumCost,
                        heuristic: currHeur
                    };
                    this.queue.add(newNode);
                    this.visitedSet[targetNode.toString()] = newNode;
                }
            }
        }
        if (this.goalState === undefined) {
            console.log("Queue empty; no path found!");
            return new SearchResult<Node>();
        } else {
            console.log("Queue empty; returning previous result!");
            return this.calculatePath(this.goalState)
        }
    }

    private calculatePath<Node>(goal: QueueNode<Node>): SearchResult<Node> {
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
        //console.log("Path calculated");
        return result;
    }
}