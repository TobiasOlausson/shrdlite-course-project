///<reference path="lib/collections.ts"/>
///<reference path="lib/node.d.ts"/>

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
    in order to reconstruct the path.*/
class QueueNode<Node> {
    parent: QueueNode<Node>;
    node: Node;
    cost: number;
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

    //Used to check for timeout (timeout : number)
    var startTime: number = Date.now();

    // Priority queue for keeping track of paths to the nodes in the graph
    var queue = new collections.PriorityQueue<QueueNode<Node>>(
        // The comparator function
        function (Object1, Object2) {
            return (Object2.cost + heuristics(Object2.node)) -
                (Object1.cost + heuristics(Object1.node))
        }
    );

    // Initiate the result to an empty path and zero cost
    var result: SearchResult<Node> = {
        path: [],
        cost: 0
    };

    //Initial queue edges
    var startNode: QueueNode<Node> = {
        parent: undefined,
        node: start,
        cost: 0
    };
    queue.enqueue(startNode);

    // Used to store nodes to which the shortest path has already been found
    // Uses as binary search tree to be able to find if nodes are in the set
    // in O(log n)
    var closedSet: collections.BSTree<Node> = new collections.BSTree<Node>(graph.compareNodes);
    closedSet.add(startNode.node);

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
                result.path.push(prev.node);
            }
            // Saves about 0.00000001s over using unshift. 
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

                // Look if the target node is in the set, with a lower cost, by comparing with all
                // nodes in the queue
                queue.forEach(function (searchNode) {
                    if (graph.compareNodes(searchNode.node, targetNode) == 0) {
                        if ((accumCost + heuristics(searchNode.node)) >= (searchNode.cost + heuristics(searchNode.node))) {
                            shorterPathExists = true;

                            // It is only safe to break the iteration if we have found a path in the queue
                            // with lower cost than the current path. There could be several paths in the queue
                            // and we cannot break if we have only found a path with higher cost.
                            return false; 
                        }
                    }
                });

                // If there is no shorter path in the queue, add the newly found one
                if (!shorterPathExists) {
                    var newNode: QueueNode<Node> = {
                        parent: current,
                        node: targetNode,
                        cost: accumCost
                    };
                    queue.enqueue(newNode);
                }
            } 
        }
    }

    // Return result, which can be empty
    return result;
}
