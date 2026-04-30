// =====================================================================
// Equal Opportunity Rotation Engine
// Pure algorithm — no DB calls. Generates a period-by-period rotation
// plan that gives every available player approximately equal court time.
//
// Inputs:
//   players: [{ id, full_name, ... }]   — AVAILABLE players only
//   periods: int                         — number of periods (e.g. 4 quarters)
//   minutesPerPeriod: int                — e.g. 8
//   blockSize: int (default 2)           — substitution interval in minutes
//
// Output (JSON, stored in rotation_plans.plan):
//   {
//     "version": 1,
//     "generated_at": ISO,
//     "format": { "periods": 4, "minutes_per_period": 8, "block_size": 2 },
//     "players_count": 8,
//     "periods": [
//       { "minute_blocks": [
//         { "from": 0, "to": 2, "on_court": [<id>, <id>, <id>, <id>, <id>] },
//         ...
//       ] },
//       ...
//     ],
//     "minutes_by_player": { "<player_id>": 20, ... }
//   }
// =====================================================================

window.GTWRotation = (function () {

  const ON_COURT = 5;

  function getBlocksForPeriod(periodMinutes, blockSize) {
    const blocks = [];
    let from = 0;
    while (from < periodMinutes) {
      const to = Math.min(from + blockSize, periodMinutes);
      blocks.push({ from, to, duration: to - from });
      from = to;
    }
    return blocks;
  }

  function generate(players, periods, minutesPerPeriod, blockSize = 2) {
    if (!Array.isArray(players)) throw new Error('players must be an array');
    if (players.length === 0) throw new Error('No available players');
    if (periods < 1 || minutesPerPeriod < 1) throw new Error('Invalid game format');

    const periodBlocks = getBlocksForPeriod(minutesPerPeriod, blockSize);
    const N = players.length;

    // Special case: ≤ 5 players → everyone plays the whole game
    if (N <= ON_COURT) {
      const everyoneOnCourt = players.map(p => p.id);
      const periodsOut = Array.from({ length: periods }, () => ({
        minute_blocks: periodBlocks.map(b => ({
          from: b.from, to: b.to, on_court: [...everyoneOnCourt]
        }))
      }));
      const minutesByPlayer = {};
      for (const p of players) minutesByPlayer[p.id] = periods * minutesPerPeriod;
      return buildOutput(periods, minutesPerPeriod, blockSize, periodsOut, minutesByPlayer, N);
    }

    // Standard case: rotate to give equal time
    // Track per-player: total minutes accumulated, last block index they were on court
    const minutes = {};
    const lastOnIdx = {};   // global block index they were last on court (-Infinity if never)
    for (const p of players) {
      minutes[p.id] = 0;
      lastOnIdx[p.id] = -Infinity;
    }

    const targetTotalMinutes = (periods * minutesPerPeriod * ON_COURT) / N;

    let globalBlockIdx = 0;
    const periodsOut = [];

    // Helper: get player's priority weight (default 1.0 = regular)
    const w = (p) => p.priority_weight ?? 1.0;

    for (let pIdx = 0; pIdx < periods; pIdx++) {
      const blocksOut = [];
      for (const b of periodBlocks) {
        // Score each player for this block:
        //   primary:   adjusted_minutes (asc)   — least played, weighted, goes first
        //                                        adjusted = minutes / priority_weight
        //                                        so a borrowed player (w=0.5) accumulates "behindness" twice as fast
        //   secondary: priority_weight (desc)   — at ties, prefer regulars (weight 1.0) over borrowed (0.5)
        //   tertiary:  lastOnIdx (asc)          — longest off court
        //   quaternary: player.id (asc)         — deterministic final tiebreaker
        const sorted = [...players].sort((a, b2) => {
          const adjA = minutes[a.id] / w(a);
          const adjB = minutes[b2.id] / w(b2);
          if (adjA !== adjB) return adjA - adjB;
          if (w(a) !== w(b2)) return w(b2) - w(a);     // higher weight first
          const r = lastOnIdx[a.id] - lastOnIdx[b2.id];
          if (r !== 0) return r;
          return a.id.localeCompare(b2.id);
        });
        const onCourt = sorted.slice(0, ON_COURT);

        for (const p of onCourt) {
          minutes[p.id] += b.duration;
          lastOnIdx[p.id] = globalBlockIdx;
        }

        blocksOut.push({
          from: b.from,
          to: b.to,
          on_court: onCourt.map(p => p.id)
        });
        globalBlockIdx++;
      }
      periodsOut.push({ minute_blocks: blocksOut });
    }

    return buildOutput(periods, minutesPerPeriod, blockSize, periodsOut, minutes, N);
  }

  function buildOutput(periods, minutesPerPeriod, blockSize, periodsOut, minutesByPlayer, playersCount) {
    return {
      version: 1,
      generated_at: new Date().toISOString(),
      format: {
        periods: periods,
        minutes_per_period: minutesPerPeriod,
        block_size: blockSize
      },
      players_count: playersCount,
      periods: periodsOut,
      minutes_by_player: minutesByPlayer
    };
  }

  // Lookup: at minute M of period P, who's on court?
  function whoIsOnCourtAt(plan, periodIdx, minuteIntoPeriod) {
    const period = plan?.periods?.[periodIdx];
    if (!period) return [];
    for (const b of period.minute_blocks) {
      if (minuteIntoPeriod >= b.from && minuteIntoPeriod < b.to) return b.on_court;
    }
    return [];
  }

  // Format the plan as a player-row × block-column matrix for printable display.
  // Returns: { columnHeaders, rows: [ { player_id, full_name, jersey_no, positions, blocks: [bool], total_minutes } ] }
  function toMatrix(plan, players) {
    const playerById = Object.fromEntries(players.map(p => [p.id, p]));
    const columnHeaders = [];
    const rowsByPlayer = {};
    for (const p of players) {
      rowsByPlayer[p.id] = {
        player_id: p.id,
        full_name: p.full_name,
        jersey_no: p.jersey_no,
        positions: p.positions || [],
        is_borrowed: !!p.is_borrowed,
        blocks: [],
        total_minutes: 0
      };
    }

    let pIdx = 0;
    for (const period of plan.periods) {
      let bIdx = 0;
      for (const b of period.minute_blocks) {
        columnHeaders.push({
          period: pIdx + 1,
          from: b.from,
          to: b.to,
          label: `Q${pIdx + 1} ${b.from}-${b.to}`
        });
        const onCourtSet = new Set(b.on_court);
        for (const p of players) {
          const onCourt = onCourtSet.has(p.id);
          rowsByPlayer[p.id].blocks.push(onCourt);
          if (onCourt) rowsByPlayer[p.id].total_minutes += (b.to - b.from);
        }
        bIdx++;
      }
      pIdx++;
    }

    return {
      columnHeaders,
      rows: Object.values(rowsByPlayer)
        .sort((a, b) => (a.jersey_no ?? 999) - (b.jersey_no ?? 999) || a.full_name.localeCompare(b.full_name))
    };
  }

  return { generate, whoIsOnCourtAt, toMatrix };
})();
