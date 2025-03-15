/**
 * Efficient priority queue implementation using binary heap
 */
class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    // Get size of queue
    size() {
        return this.heap.length;
    }

    // Check if queue is empty
    isEmpty() {
        return this.heap.length === 0;
    }

    // Add element with priority
    enqueue(element, priority = 0) {
        const node = { element, priority };
        this.heap.push(node);
        
        // Bubble up to maintain heap property
        this._bubbleUp(this.heap.length - 1);
    }

    // Remove and return highest priority element
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        
        // Get the highest priority element
        const top = this.heap[0];
        const bottom = this.heap.pop();
        
        if (this.heap.length > 0) {
            // Move last element to top and sink down
            this.heap[0] = bottom;
            this._sinkDown(0);
        }
        
        return top.element;
    }

    // Helper method to bubble up an element
    _bubbleUp(index) {
        const node = this.heap[index];
        
        // Keep bubbling up while we haven't reached the root
        // and parent has higher priority value (lower priority)
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.heap[parentIndex];
            
            // If parent has lower or same priority, we're done
            if (node.priority >= parent.priority) {
                break;
            }
            
            // Otherwise, swap with parent
            this.heap[parentIndex] = node;
            this.heap[index] = parent;
            index = parentIndex;
        }
    }

    // Helper method to sink down an element
    _sinkDown(index) {
        const length = this.heap.length;
        const node = this.heap[index];
        
        while (true) {
            // Calculate child indices
            const leftChildIndex = 2 * index + 1;
            const rightChildIndex = 2 * index + 2;
            
            let swapIndex = null;
            
            // If left child exists
            if (leftChildIndex < length) {
                const leftChild = this.heap[leftChildIndex];
                
                // If left child has higher priority, we want to swap with it
                if (leftChild.priority < node.priority) {
                    swapIndex = leftChildIndex;
                }
            }
            
            // If right child exists
            if (rightChildIndex < length) {
                const rightChild = this.heap[rightChildIndex];
                
                // If right child has higher priority than both the node and left child
                if (
                    (swapIndex === null && rightChild.priority < node.priority) ||
                    (swapIndex !== null && rightChild.priority < this.heap[swapIndex].priority)
                ) {
                    swapIndex = rightChildIndex;
                }
            }
            
            // If no swaps needed, we're done
            if (swapIndex === null) {
                break;
            }
            
            // Swap with the child that has higher priority
            this.heap[index] = this.heap[swapIndex];
            this.heap[swapIndex] = node;
            index = swapIndex;
        }
    }
}

export { PriorityQueue };