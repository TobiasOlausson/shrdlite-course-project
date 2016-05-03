///<reference path="lib/collections.ts"/>
///<reference path="lib/node.d.ts"/>

/** Graph module
 *
 *  Types for generic A\* implementation.
 *
 *  *NB.* The only part of this module
 *  that you should change is the `aStarSearch` function. Everything
 *  else should be used as-is.
 */

/** An edge in a graph. */
class Edge<Node> {
    from : Node;
    to   : Node;
    cost : number;
}

/** A directed graph. */
interface Graph<Node> {
    /** Computes the edges that leave from a node. */
    outgoingEdges(node : Node) : Edge<Node>[];
    /** A function that compares nodes. */
    compareNodes : collections.ICompareFunction<Node>;
}

/** Type that reports the result of a search. */
class SearchResult<Node> {
    /** The path (sequence of Nodes) found by the search algorithm. */
    path : Node[];
    /** The total cost of the path. */
    cost : number;
}

/**
 * A\* search implementation, parameterised by a `Node` type. The code
 * here is just a template; you should rewrite this function
 * entirely. In this template, the code produces a dummy search result
 * which just picks the first possible neighbour.
 *
 * Note that you should not change the API (type) of this function,
 * only its body.
 * @param graph The graph on which to perform A\* search.
 * @param start The initial node.
 * @param goal A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
 * @param heuristics The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
 * @param timeout Maximum time (in seconds) to spend performing A\* search.
 * @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
 */
function aStarSearch<Node> (
    graph : Graph<Node>,
    start : Node,
    goal : (n:Node) => boolean,
    heuristics : (n:Node) => number,
    timeout : number
) : SearchResult<Node> {
    var pQueue = new collections.PriorityQueue<SearchResult<Node>>(
	function(Object1, Object2){
            return (Object2.cost + heuristics(Object2.path[Object2.path.length-1])) -
                (Object1.cost + heuristics(Object1.path[Object1.path.length-1]))
	});
    var result : SearchResult<Node> = {
        path: [start],
        cost: 0
    };

    //Used to check for timeout (timeout : number)
    var startTime : number = Date.now();
    
    //Initial queue edges
    var startEdges : Edge<Node>[] = graph.outgoingEdges(start);
    for (var i = 0; i < startEdges.length; i++){
	var tmp2 : SearchResult<Node> = {
            path: [start],
            cost: 0
	};

	tmp2.cost += startEdges[i].cost;
	tmp2.path.push(startEdges[i].to);
	pQueue.enqueue(tmp2);
    }

    //Used to store the node with the lowest f value
    var closedSet : collections.Dictionary<Node, number> =
	new collections.Dictionary<Node, number>();
    closedSet.setValue(start, 0);

    //Iteration
    while (!pQueue.isEmpty()) {
	// Check for timeout
	if(Date.now() - startTime >= (timeout*1000)){
            return result;
	}

	var s : SearchResult<Node> = pQueue.dequeue();
	
	if (goal(s.path[s.path.length-1])) {
            return s;
	}

        //Add neighbouring edges to queue
	var adjEdges : Edge<Node>[] = 
            graph.outgoingEdges(s.path[s.path.length-1]);

	for (var i = 0; i < adjEdges.length; i++){

            // check to see if already in path
            var inPath : boolean = false;
            for(var j = 0; j < s.path.length; j++){
		if(graph.compareNodes(adjEdges[i].to, s.path[j]) == 0){
		    inPath = true;
		    break;
		}
            }
            // If node found in closed set with lower f value, do not add
            var lowerInClosed : boolean = false;

	    var storedFValue : number = closedSet.getValue(adjEdges[i].from);
	    if (storedFValue < s.cost + adjEdges[i].cost + heuristics(adjEdges[i].to)) {
		lowerInClosed = true;
	    }

            // if not in path, add to path and add to queue
            if(!inPath && !lowerInClosed){
		var tmp3 : SearchResult<Node> = newTemp(s);
		tmp3.cost += adjEdges[i].cost;
		tmp3.path = tmp3.path;
		tmp3.path.push(adjEdges[i].to);
		pQueue.enqueue(tmp3);
            }

	}
	// Add node to closed set
	closedSet.setValue(s.path[s.path.length-1],
			   s.cost + heuristics(s.path[s.path.length-1]));
    }
    return result;
}


function newTemp<Node>(s1:SearchResult<Node>) : SearchResult<Node> {
    var nodes: Node[] = [];

    for(var q = 0; q < s1.path.length; q++) {
	nodes.push(s1.path[q]);
    }

    var newT: SearchResult<Node> = {
	path: nodes,
	cost: s1.cost
    };

    return newT;
}
