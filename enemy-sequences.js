// Enemy animation sequences
// Each sequence defines a complete enemy encounter from start to finish
// The game will randomly select one sequence when spawning an enemy

const ENEMY_SEQUENCES = {
    rat: [
        // rat_sequence_2 - DEFAULT - 12 step sequence with 7 second durations
        {
            name: 'rat_sequence_2',
            steps: [
                { animation: 'approaching', startPos: 25, endPos: 50, duration: 7000 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 7000 },
                { animation: 'leaving', startPos: 50, endPos: 75, duration: 7000 }
            ]
        },
        
        // rat_default - Simple 4 step sequence
        {
            name: 'rat_default',
            steps: [
                { animation: 'approaching', startPos: 0, endPos: 50, duration: 3000 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 2000 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1500 },
                { animation: 'leaving', startPos: 50, endPos: 100, duration: 3000 }
            ]
        },
            steps: [
                { animation: 'approaching', startPos: 0, endPos: 50, duration: 3000 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 1500 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 800 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'leaving', startPos: 50, endPos: 100, duration: 3000 }
            ]
        },
        
        // Cautious sequence - more pacing, fewer attacks
        {
            name: 'rat_cautious',
            steps: [
                { animation: 'approaching', startPos: 0, endPos: 50, duration: 3000 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 2500 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 1800 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 2000 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'leaving', startPos: 50, endPos: 100, duration: 3000 }
            ]
        },
        
        // Quick encounter - short and brutal
        {
            name: 'rat_quick',
            steps: [
                { animation: 'approaching', startPos: 0, endPos: 50, duration: 2500 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1000 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 1000 },
                { animation: 'leaving', startPos: 50, endPos: 100, duration: 2500 }
            ]
        },
        
        // Intimidating sequence - lots of posturing
        {
            name: 'rat_intimidating',
            steps: [
                { animation: 'approaching', startPos: 0, endPos: 50, duration: 3000 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 2000 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 1500 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 2000 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'menacing', startPos: 50, endPos: 50, duration: 1500 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 1200 },
                { animation: 'leaving', startPos: 50, endPos: 100, duration: 3000 }
            ]
        },
        
        // Relentless sequence - many attacks
        {
            name: 'rat_relentless',
            steps: [
                { animation: 'approaching', startPos: 0, endPos: 50, duration: 2800 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1100 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 1100 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 800 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1100 },
                { animation: 'attack2', startPos: 50, endPos: 50, duration: 1100 },
                { animation: 'pacing', startPos: 50, endPos: 50, duration: 600 },
                { animation: 'attack1', startPos: 50, endPos: 50, duration: 1100 },
                { animation: 'leaving', startPos: 50, endPos: 100, duration: 3000 }
            ]
        }
    ]
};

// Export for use in modules or direct script inclusion
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ENEMY_SEQUENCES;
}
