///<reference path="lib/collections.ts"/>
///<reference path="lib/node.d.ts"/>

/** Graph module
*
*  Types for generic A\* implementation.
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

/** Type stored in the priority queue. Keeps track of its parent
    in order to reconstruct the path.*/
class StoredNode<Node> {
  parent : Node;
  current : Node;
  cost : number;
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
function aStarSearch<Node> (
  graph : Graph<Node>,
  start : Node,
  goal : (n:Node) => boolean,
  heuristics : (n:Node) => number,
  timeout : number
  ) : SearchResult<Node> {
  var pQueue = new collections.PriorityQueue<StoredNode<Node>>(
    function(Object1, Object2){
        return (Object2.cost + heuristics(Object2.current)) -
        (Object1.cost + heuristics(Object1.current))
    }
  );

  var result : SearchResult<Node> = {
    path: [],
    cost: 0
  };

  //Used to check for timeout (timeout : number)
  var startTime : number = Date.now();

  //Initial queue edges
  var tmp : StoredNode<Node> = {
    parent: undefined,
    current: start,
    cost: 0
  };
  pQueue.enqueue(tmp);


  //Used to store the node with the lowest f value
  var closedSetNode : StoredNode<Node>[] = [];
  closedSetNode.push(tmp);

  //Iteration
  while(!pQueue.isEmpty()) {
    // Check for timeout, return empty result
    if(Date.now() - startTime >= (timeout*1000)){
      return result;
    }

    // First element in priority queue
    var first : StoredNode<Node> = pQueue.dequeue();
    closedSetNode.push(first);

    // Goal found, reconstruct path
    if (goal(first.current)) {
      var next : StoredNode<Node> = first;
      result.cost += first.cost;
      result.path.push(first.current);
      while(true){
        for(var n = 0; n < closedSetNode.length; n++){
          if(next.parent == null)
            return result;
          if(graph.compareNodes(closedSetNode[n].current, next.parent) == 0){
            next = closedSetNode[n];
            result.path.unshift(next.current);
            if(next.parent == undefined)
              return result;
          }
        }
      }
    }

    //Add neighbouring edges to queue
    var adjEdges : Edge<Node>[] = 
      graph.outgoingEdges(first.current);
    for(var i = 0; i < adjEdges.length; i++){

      // If in open set with lower cost, do not add successor
      var inOpen : boolean = false;
      pQueue.forEach(function(Object1){
        if(graph.compareNodes(Object1.current, adjEdges[i].to) == 0 && 
          (Object1.cost + heuristics(Object1.current)) <= 
            (adjEdges[i].cost + first.cost + heuristics(adjEdges[i].to))){
          inOpen = true;
          return;
        }
      });

      // If in closed, do not add successor
      var inClosed : boolean = false;
      for(var j = 0; j < closedSetNode.length; j++){
        if(graph.compareNodes(closedSetNode[j].current, adjEdges[i].to) == 0){
          inClosed = true;
          break;
        }
      }

      // if not in closed and not in open set, add to open set
      if(!inOpen && !inClosed){
        var tmp2 : StoredNode<Node> = {
          parent: first.current,
          current: adjEdges[i].to,
          cost: first.cost + adjEdges[i].cost
        };
        pQueue.enqueue(tmp2);
      }
    }
  }

  // no path was found, return empty result
  return result;
}