/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        OUTPUT_FILE: "/planning/augmentation_plan.txt",
        PRIORITIES: {
            // Priority scoring for different augmentation types
            HACKING: 100,
            MONEY: 90,
            FACTION_REP: 80,
            COMPANY_REP: 70,
            COMBAT: 60,
            CHARISMA: 50,
            MISC: 40
        },
        SINGULARITY_AVAILABLE: false
    };

    ns.disableLog("sleep");

    // Check if Singularity API is available
    try {
        if (ns.singularity && typeof ns.singularity.getOwnedAugmentations === 'function') {
            // Test if we can actually call the function (Source-File 4 check)
            ns.singularity.getOwnedAugmentations(false);
            CONFIG.SINGULARITY_AVAILABLE = true;
            ns.print("Singularity API available - full augmentation planning enabled");
        } else {
            ns.print("Singularity API not available - limited planning mode");
        }
    } catch (error) {
        ns.print(`Singularity API not available - limited planning mode (${error.message})`);
        CONFIG.SINGULARITY_AVAILABLE = false;
    }

    if (!CONFIG.SINGULARITY_AVAILABLE) {
        ns.tprint("Augmentation Planner requires Singularity API (Source-File 4)");
        ns.tprint("Currently running in limited mode - basic faction priority only");
        await createBasicFactionPlan();
        return;
    }

    // Main augmentation planning
    await createAugmentationPlan();

    async function createAugmentationPlan() {
        ns.tprint("=== AUGMENTATION PLANNER ===");

        // Get current state
        const ownedAugs = ns.singularity.getOwnedAugmentations(true); // Include pending
        const installedAugs = ns.singularity.getOwnedAugmentations(false); // Only installed
        const player = ns.getPlayer();

        ns.print(`Currently owned augmentations: ${ownedAugs.length}`);
        ns.print(`Installed augmentations: ${installedAugs.length}`);

        // Get all available augmentations with analysis
        const augmentationAnalysis = await analyzeAllAugmentations(ownedAugs);

        // Create acquisition plan
        const acquisitionPlan = createAcquisitionPlan(augmentationAnalysis);

        // Create faction priority list
        const factionPriorities = createFactionPriorities(acquisitionPlan);

        // Generate output
        const report = generateReport(acquisitionPlan, factionPriorities, player);

        // Save to file
        await saveReport(report);

        // Update HUD port with summary data
        updateHUD(factionPriorities, acquisitionPlan);

        ns.tprint(`Augmentation plan created! Priority factions: ${factionPriorities.slice(0, 3).map(f => f.name).join(", ")}`);
    }

    async function analyzeAllAugmentations(ownedAugs) {
        const allFactions = [
            "CyberSec", "Tian Di Hui", "Netburners", "Sector-12", "Chongqing", "New Tokyo",
            "Ishima", "Aevum", "Volhaven", "NiteSec", "The Black Hand", "BitRunners",
            "ECorp", "MegaCorp", "KuaiGong International", "Four Sigma", "NWO",
            "Blade Industries", "OmniTek Incorporated", "Bachman & Associates",
            "Clarke Incorporated", "OmniAlpha", "Fulcrum Secret Technologies",
            "Slum Snakes", "Tetrads", "Silhouette", "Speakers for the Dead",
            "The Dark Army", "The Syndicate", "The Covenant", "Daedalus",
            "Illuminati"
        ];

        const augmentations = [];

        for (const faction of allFactions) {
            try {
                const factionAugs = ns.singularity.getAugmentationsFromFaction(faction);

                for (const augName of factionAugs) {
                    if (ownedAugs.includes(augName)) continue;

                    try {
                        const stats = ns.singularity.getAugmentationStats(augName);
                        const price = ns.singularity.getAugmentationPrice(augName);
                        const repReq = ns.singularity.getAugmentationRepReq(augName);
                        const prereqs = ns.singularity.getAugmentationPrereq(augName);

                        // Calculate priority score
                        const priority = calculateAugmentationPriority(augName, stats);

                        augmentations.push({
                            name: augName,
                            faction: faction,
                            stats: stats,
                            price: price,
                            repReq: repReq,
                            prereqs: prereqs,
                            priority: priority,
                            available: prereqs.every(p => ownedAugs.includes(p))
                        });
                    } catch (error) {
                        ns.print(`Error analyzing augmentation ${augName}: ${error.message}`);
                    }
                }
            } catch (error) {
                // Faction might not exist or be available
                continue;
            }
        }

        return augmentations;
    }

    function calculateAugmentationPriority(name, stats) {
        let priority = 0;

        // Hacking multipliers (highest priority)
        if (stats.hacking_mult && stats.hacking_mult > 1) {
            priority += CONFIG.PRIORITIES.HACKING * (stats.hacking_mult - 1) * 100;
        }
        if (stats.hacking_exp_mult && stats.hacking_exp_mult > 1) {
            priority += CONFIG.PRIORITIES.HACKING * (stats.hacking_exp_mult - 1) * 50;
        }
        if (stats.hacking_speed_mult && stats.hacking_speed_mult > 1) {
            priority += CONFIG.PRIORITIES.HACKING * (stats.hacking_speed_mult - 1) * 30;
        }

        // Money multipliers
        if (stats.hacking_money_mult && stats.hacking_money_mult > 1) {
            priority += CONFIG.PRIORITIES.MONEY * (stats.hacking_money_mult - 1) * 80;
        }
        if (stats.work_money_mult && stats.work_money_mult > 1) {
            priority += CONFIG.PRIORITIES.MONEY * (stats.work_money_mult - 1) * 40;
        }

        // Reputation multipliers
        if (stats.faction_rep_mult && stats.faction_rep_mult > 1) {
            priority += CONFIG.PRIORITIES.FACTION_REP * (stats.faction_rep_mult - 1) * 60;
        }
        if (stats.company_rep_mult && stats.company_rep_mult > 1) {
            priority += CONFIG.PRIORITIES.COMPANY_REP * (stats.company_rep_mult - 1) * 40;
        }

        // Special high-value augmentations
        const highValueAugs = [
            "NeuroFlux Governor", "Artificial Synaptic Potentiation", "Augmented Targeting I",
            "BitWire", "Artificial Bio-neural Network Implant", "CashRoot Starter Kit",
            "DataJack", "Neuralstimulator", "The Red Pill"
        ];

        if (highValueAugs.includes(name)) {
            priority += 200;
        }

        return Math.round(priority);
    }

    function createAcquisitionPlan(augmentations) {
        // Sort by priority (high to low) and availability
        const availableAugs = augmentations.filter(aug => aug.available);
        const unavailableAugs = augmentations.filter(aug => !aug.available);

        availableAugs.sort((a, b) => b.priority - a.priority);
        unavailableAugs.sort((a, b) => b.priority - a.priority);

        return {
            immediate: availableAugs.slice(0, 10), // Top 10 available
            future: unavailableAugs.slice(0, 20),  // Top 20 for future planning
            all: [...availableAugs, ...unavailableAugs]
        };
    }

    function createFactionPriorities(acquisitionPlan) {
        const factionScores = {};

        // Score factions based on valuable augmentations they offer
        for (const aug of acquisitionPlan.immediate) {
            if (!factionScores[aug.faction]) {
                factionScores[aug.faction] = { name: aug.faction, score: 0, augs: [] };
            }
            factionScores[aug.faction].score += aug.priority;
            factionScores[aug.faction].augs.push(aug.name);
        }

        // Add future augmentations with reduced weight
        for (const aug of acquisitionPlan.future) {
            if (!factionScores[aug.faction]) {
                factionScores[aug.faction] = { name: aug.faction, score: 0, augs: [] };
            }
            factionScores[aug.faction].score += aug.priority * 0.3; // 30% weight for future augs
            if (!factionScores[aug.faction].augs.includes(aug.name)) {
                factionScores[aug.faction].augs.push(aug.name);
            }
        }

        return Object.values(factionScores).sort((a, b) => b.score - a.score);
    }

    function generateReport(acquisitionPlan, factionPriorities, player) {
        const lines = [];
        lines.push("=== AUGMENTATION ACQUISITION PLAN ===");
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push(`Player Level: ${player.skills.hacking}`);
        lines.push("");

        lines.push("=== IMMEDIATE PRIORITY AUGMENTATIONS ===");
        acquisitionPlan.immediate.forEach((aug, i) => {
            lines.push(`${i + 1}. ${aug.name} (${aug.faction})`);
            lines.push(`   Priority: ${aug.priority}, Price: $${aug.price.toLocaleString()}, Rep: ${aug.repReq.toLocaleString()}`);
            if (aug.prereqs.length > 0) {
                lines.push(`   Prerequisites: ${aug.prereqs.join(", ")}`);
            }
        });

        lines.push("");
        lines.push("=== FACTION PRIORITIES ===");
        factionPriorities.slice(0, 10).forEach((faction, i) => {
            lines.push(`${i + 1}. ${faction.name} (Score: ${Math.round(faction.score)})`);
            lines.push(`   Key Augmentations: ${faction.augs.slice(0, 3).join(", ")}`);
        });

        lines.push("");
        lines.push("=== FUTURE CONSIDERATIONS ===");
        acquisitionPlan.future.slice(0, 10).forEach((aug, i) => {
            lines.push(`${i + 1}. ${aug.name} (${aug.faction}) - ${aug.prereqs.length > 0 ? 'Needs: ' + aug.prereqs.join(", ") : 'Available'}`);
        });

        return lines.join("\n");
    }

    async function createBasicFactionPlan() {
        // Basic faction priority without Singularity API
        const basicFactionPriorities = [
            { name: "CyberSec", reason: "Early hacking augmentations, backdoor access" },
            { name: "Tian Di Hui", reason: "Basic augmentations, easy entry" },
            { name: "Netburners", reason: "Hacking-focused, accessible early" },
            { name: "NiteSec", reason: "Good hacking augmentations" },
            { name: "The Black Hand", reason: "Advanced hacking augmentations" },
            { name: "BitRunners", reason: "High-tier hacking augmentations" },
            { name: "Daedalus", reason: "End-game augmentations including The Red Pill" }
        ];

        const report = [
            "=== BASIC FACTION PRIORITY PLAN ===",
            "Note: Limited mode - Singularity API not available",
            "",
            "Recommended faction progression:",
            ...basicFactionPriorities.map((f, i) => `${i + 1}. ${f.name} - ${f.reason}`)
        ].join("\n");

        await saveReport(report);

        // Update HUD with basic faction data
        const basicHudData = {
            topFactions: basicFactionPriorities.slice(0, 3).map((f, i) => ({
                name: f.name,
                score: 100 - i * 10 // Simple descending score
            })),
            nextAugmentations: [
                { name: "Planning Required", faction: "N/A", price: 0, repReq: 0 }
            ],
            lastUpdate: Date.now()
        };

        try {
            ns.clearPort(3);
            ns.writePort(3, JSON.stringify(basicHudData));
        } catch (error) {
            ns.print(`Could not update HUD: ${error.message}`);
        }

        ns.tprint("Basic faction priority plan created (limited mode)");
    }

    async function saveReport(report) {
        try {
            // Ensure directory exists
            if (!ns.fileExists("/planning/")) {
                ns.write("/planning/temp.txt", "", "w");
                ns.rm("/planning/temp.txt");
            }

            ns.write(CONFIG.OUTPUT_FILE, report, "w");
            ns.print(`Report saved to ${CONFIG.OUTPUT_FILE}`);
        } catch (error) {
            ns.print(`Could not save report: ${error.message}`);
        }
    }

    function updateHUD(factionPriorities, acquisitionPlan) {
        try {
            const hudData = {
                topFactions: factionPriorities.slice(0, 3).map(f => ({
                    name: f.name,
                    score: f.score
                })),
                nextAugmentations: acquisitionPlan.immediate.slice(0, 2).map(aug => ({
                    name: aug.name,
                    faction: aug.faction,
                    price: aug.price,
                    repReq: aug.repReq,
                    priority: aug.priority
                })),
                lastUpdate: Date.now()
            };

            ns.clearPort(3);
            ns.writePort(3, JSON.stringify(hudData));
            ns.print("HUD data updated on port 3");
        } catch (error) {
            ns.print(`Could not update HUD: ${error.message}`);
        }
    }
}