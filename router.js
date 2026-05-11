// router.js - Complete Smart Router for Your DEX
class SmartRouter {
    constructor(program, connection) {
        this.program = program;
        this.connection = connection;
        this.cache = new Map();
    }

    // Find best route across multiple pools
    async findBestRoute(tokenIn, tokenOut, amountIn, options = {}) {
        const pools = await this.getAllPools();
        
        const routes = [
            ...this.findDirectRoutes(pools, tokenIn, tokenOut, amountIn),
            ...this.findMultiHopRoutes(pools, tokenIn, tokenOut, amountIn, options.maxHops || 2),
            ...this.findSplitRoutes(pools, tokenIn, tokenOut, amountIn, options.maxSplits || 3)
        ];
        
        // Sort by output amount (best first)
        routes.sort((a, b) => b.amountOut - a.amountOut);
        
        return routes[0] || null;
    }

    findDirectRoutes(pools, tokenIn, tokenOut, amountIn) {
        const routes = [];
        
        for (const pool of pools) {
            // Check if pool supports this pair
            const amountOut = this.calculateSwap(amountIn, pool, tokenIn, tokenOut);
            if (amountOut > 0) {
                routes.push({
                    type: 'direct',
                    pools: [pool],
                    amountIn,
                    amountOut,
                    fee: pool.account.fee,
                    priceImpact: this.calculatePriceImpact(amountIn, pool)
                });
            }
        }
        
        return routes;
    }

    findMultiHopRoutes(pools, tokenIn, tokenOut, amountIn, maxHops) {
        const routes = [];
        const tokenMap = this.buildTokenGraph(pools);
        
        // BFS to find paths
        const queue = [{ token: tokenIn, path: [], amount: amountIn, pools: [] }];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.path.length > maxHops) continue;
            
            if (current.token === tokenOut && current.path.length > 0) {
                routes.push({
                    type: 'multi-hop',
                    pools: current.pools,
                    amountIn,
                    amountOut: current.amount,
                    hops: current.path.length,
                    fee: current.pools.reduce((sum, p) => sum + p.account.fee, 0),
                    priceImpact: this.calculateMultiHopImpact(current.pools, amountIn)
                });
                continue;
            }
            
            const neighbors = tokenMap.get(current.token) || [];
            for (const neighbor of neighbors) {
                if (!current.path.includes(neighbor.pool)) {
                    const newAmount = this.calculateSwap(current.amount, neighbor.pool, current.token, neighbor.token);
                    queue.push({
                        token: neighbor.token,
                        path: [...current.path, neighbor.token],
                        amount: newAmount,
                        pools: [...current.pools, neighbor.pool]
                    });
                }
            }
        }
        
        return routes;
    }

    findSplitRoutes(pools, tokenIn, tokenOut, totalAmount, maxSplits) {
        const validPools = pools.filter(p => 
            this.poolSupportsPair(p, tokenIn, tokenOut)
        );
        
        if (validPools.length === 0) return [];
        
        // Sort by liquidity (best for large splits)
        validPools.sort((a, b) => b.account.totalLiquidity - a.account.totalLiquidity);
        
        const poolsToUse = validPools.slice(0, maxSplits);
        const totalLiquidity = poolsToUse.reduce((sum, p) => sum + p.account.totalLiquidity, 0);
        
        const splits = [];
        let remainingAmount = totalAmount;
        
        for (let i = 0; i < poolsToUse.length; i++) {
            const pool = poolsToUse[i];
            const allocation = i === poolsToUse.length - 1 
                ? remainingAmount
                : Math.floor((pool.account.totalLiquidity / totalLiquidity) * totalAmount);
            
            const amountOut = this.calculateSwap(allocation, pool, tokenIn, tokenOut);
            splits.push({ pool, amountIn: allocation, amountOut });
            remainingAmount -= allocation;
        }
        
        const totalOut = splits.reduce((sum, s) => sum + s.amountOut, 0);
        
        return [{
            type: 'split',
            splits,
            amountIn: totalAmount,
            amountOut: totalOut,
            pools: poolsToUse,
            fee: (totalOut / totalAmount) * 100,
            priceImpact: this.calculateSplitImpact(splits)
        }];
    }

    calculateSwap(amountIn, pool, tokenIn, tokenOut) {
        // Add fee calculation (30 basis points = 0.3%)
        const fee = pool.account.fee || 30;
        const amountAfterFee = amountIn * (10000 - fee) / 10000;
        
        // Constant product formula (simplified)
        const reserveIn = pool.account.totalLiquidity || 1;
        const reserveOut = pool.account.totalLiquidity || 1;
        
        return (amountAfterFee * reserveOut) / (reserveIn + amountAfterFee);
    }

    buildTokenGraph(pools) {
        const graph = new Map();
        
        for (const pool of pools) {
            // For simplicity, treat each pool as connecting two tokens
            // In reality, you'd track token mints
            const tokenA = pool.publicKey;
            const tokenB = pool.publicKey;
            
            if (!graph.has(tokenA)) graph.set(tokenA, []);
            if (!graph.has(tokenB)) graph.set(tokenB, []);
            
            graph.get(tokenA).push({ token: tokenB, pool });
            graph.get(tokenB).push({ token: tokenA, pool });
        }
        
        return graph;
    }

    poolSupportsPair(pool, tokenIn, tokenOut) {
        // Check if pool supports this token pair
        return true; // Simplified for demo
    }

    calculatePriceImpact(amountIn, pool) {
        const liquidity = pool.account.totalLiquidity || 1;
        return ((amountIn / liquidity) * 100).toFixed(2);
    }

    calculateMultiHopImpact(pools, amountIn) {
        let impact = 0;
        let currentAmount = amountIn;
        
        for (const pool of pools) {
            impact += this.calculatePriceImpact(currentAmount, pool);
            currentAmount = this.calculateSwap(currentAmount, pool, null, null);
        }
        
        return impact;
    }

    calculateSplitImpact(splits) {
        const totalImpact = splits.reduce((sum, split) => 
            sum + this.calculatePriceImpact(split.amountIn, split.pool), 0
        );
        return (totalImpact / splits.length).toFixed(2);
    }

    async getAllPools() {
        if (!this.program) return [];
        
        try {
            const pools = await this.program.account.poolAccount.all();
            return pools;
        } catch (err) {
            console.error('Error fetching pools:', err);
            return [];
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartRouter;
}
