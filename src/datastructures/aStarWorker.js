import { Graph } from './graph.js';

self.onmessage = function (e) {
    const { graphData, startId, endId } = e.data;
    const graph = Graph.fromJSON(graphData);
    const path = graph.aStar(startId, endId);
    self.postMessage(path);
};