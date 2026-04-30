// =====================================================================
// Comms — pure module for token substitution and rotation chart text formatting
// Used by game-week.js to render the three weekly messages.
// =====================================================================
window.GTWComms = (function () {

  // ---------- TOKEN SUBSTITUTION ----------

  // Replace {{token}} occurrences in template with values from ctx.
  // Unknown tokens left as-is (visible to coach as a hint).
  function render(template, ctx) {
    if (!template) return '';
    return template.replace(/\{\{(\w+)\}\}/g, (full, key) => {
      if (key in ctx) return ctx[key];
      return full;   // leave unresolved token visible
    });
  }

  // ---------- DATE / TIME FORMATTING ----------

  function fmtDate(d) {
    if (!d) return 'TBD';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function fmtTime(t) {
    if (!t) return 'TBD';
    return t.slice(0, 5);
  }

  // ---------- ROTATION CHART TEXT (for {{rotation_chart}}) ----------

  // Format the rotation plan as plain text suitable for WhatsApp.
  // Shows each block with player names, plus a per-player minutes summary.
  function rotationChartText(plan, players) {
    if (!plan?.periods?.length) return '(rotation not yet generated)';

    const playerById = {};
    for (const p of players) playerById[p.id] = p;

    const lines = [];
    let pIdx = 0;
    for (const period of plan.periods) {
      let bIdx = 0;
      for (const b of period.minute_blocks) {
        const onCourtNames = b.on_court
          .map(id => playerById[id]?.full_name || '?')
          .join(', ');
        const blockLabel = `Q${pIdx + 1} ${b.from}-${b.to}`;
        lines.push(`  ${blockLabel}: ${onCourtNames}`);
        bIdx++;
      }
      pIdx++;
    }

    // Per-player minutes summary
    const minutes = plan.minutes_by_player || {};
    const summary = Object.entries(minutes)
      .map(([id, m]) => ({ name: playerById[id]?.full_name || '?', minutes: m }))
      .sort((a, b) => b.minutes - a.minutes)
      .map(x => `${x.name} ${x.minutes}m`)
      .join(' · ');

    if (summary) {
      lines.push('');
      lines.push(`Minutes: ${summary}`);
    }

    return lines.join('\n');
  }

  // ---------- BUILD CONTEXT FROM GAME STATE ----------

  // Produce a token-context dict from the game-week view state.
  // Different message types use different subsets of tokens.
  function buildContext({ game, dutyAssignment, rotationPlan, players, availableCount, unconfirmedList, homeAway }) {
    return {
      team_name:        game?.team?.name || '',
      game_date:        fmtDate(game?.game_date),
      game_time:        fmtTime(game?.game_time),
      venue:            game?.venue || 'TBD',
      court:            game?.court || '',
      opposition:       game?.opposition?.name || 'TBD',
      duty_family:      dutyAssignment
                          ? (dutyAssignment.player?.full_name + (dutyAssignment.player?.family?.family_name
                              ? ` (${dutyAssignment.player.family.family_name} family)` : ''))
                          : '(not assigned)',
      rotation_chart:   rotationPlan ? rotationChartText(rotationPlan.plan, players) : '(rotation not yet generated)',
      available_count:  availableCount ?? 0,
      unconfirmed_list: unconfirmedList || ''
    };
  }

  return {
    render,
    rotationChartText,
    buildContext,
    fmtDate,
    fmtTime
  };
})();
