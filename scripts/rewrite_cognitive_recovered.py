from pathlib import Path
from textwrap import dedent

p = Path(r"C:\Users\ASUS\Desktop\糯米机二改\SULLYTEST2\apps\CognitiveNetworkApp.recovered.tsx")
text = p.read_text(encoding="utf-8")
lines = text.splitlines()

replacements = {
    73: "    const [selectedCharId, setSelectedCharId] = useState<string | null>(null); // null = 全部角色",
    167: "            // 汇总全部角色；后端可能缺少部分字段，默认补 0",
    189: "    // 初次连接后只拉取一次统计，避免重复请求",
    213: "            console.warn('加载图谱统计失败', e);",
    387: "            // 后端先把需要补语义边的记忆入队，真正逐条处理仍走 semantic-process-one",
    449: "    // Distillation 需要完整 embedding 配置，因此使用 fullHeaders",
    466: "                if (result.l1Created > 0) parts.push(`${result.l1Created} 个新 L1`);",
    467: "                if (result.l1Merged > 0) parts.push(`${result.l1Merged} 个合并`);",
    468: "                if (result.l1Deduped > 0) parts.push(`${result.l1Deduped} 个去重`);",
    497: "                if (result.l1Created > 0) parts.push(`${result.l1Created} 个新 L1`);",
    498: "                if (result.l1Merged > 0) parts.push(`${result.l1Merged} 个合并`);",
    499: "                if (result.l1Deduped > 0) parts.push(`${result.l1Deduped} 个去重`);",
    549: "    /* Render */",
    551: "    /* Main UI */",
    694: "                                    // 先拿到云端角色列表，再把本地和云端角色做并集，逐个拉取",
    754: "                            {syncResult.pushed > 0 && syncResult.pulled > 0 && ' · '}",
}

for lineno, value in replacements.items():
    lines[lineno - 1] = value

tail_parts = []
tail_parts.append(dedent('''
                {/* Stats Dashboard */}
                {!isConnected ? (
                    <section className="bg-white/60 backdrop-blur-sm rounded-[24px] p-6 shadow-sm border border-white/50 text-center">
                        <div className="text-3xl mb-3 opacity-60">ST</div>
                        <p className="text-xs text-slate-400">请先连接后端，才能加载图谱统计与分析工具。</p>
                    </section>
                ) : loading && !allStats ? (
                    <section className="flex justify-center py-6">
                        <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                    </section>
                ) : (() => {
                    const stats = currentStats || { memories: 0, relations: 0, temporalEdges: 0, semanticEdges: 0, linkedCount: 0, unscannedCount: 0 };
                    return (
                        <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm shadow-sm">ST</div>
                                <div>
                                    <h3 className="text-[13px] font-bold text-slate-700">统计总览</h3>
                                    <p className="text-[9px] text-slate-400">
                                        {selectedCharId ? `${charNameMap(selectedCharId)} 的图谱统计` : '全部角色图谱统计'}
                                    </p>
                                </div>
                            </div>

                            {statsFailed && (
                                <div className="mb-3 px-3 py-2 bg-amber-50/80 border border-amber-100 rounded-xl flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-amber-600">警告</span>
                                    <p className="text-[10px] text-amber-600/80 font-medium flex-1">后端统计加载失败，你可以稍后重试。</p>
                                    <button
                                        onClick={fetchStats}
                                        disabled={loading}
                                        className="text-[9px] font-bold text-amber-500 bg-white px-2 py-1 rounded-lg shrink-0"
                                    >
                                        {loading ? '刷新中...' : '重试'}
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: stats.memories, label: '记忆数', icon: 'M', gradient: 'from-indigo-50 to-violet-50', border: 'border-indigo-100/60', text: 'text-indigo-700', sub: 'text-indigo-300' },
                                    { value: stats.semanticEdges, label: '语义边', icon: 'S', gradient: 'from-violet-50 to-fuchsia-50', border: 'border-violet-100/60', text: 'text-violet-700', sub: 'text-violet-300' },
                                    { value: stats.temporalEdges, label: '时序边', icon: 'T', gradient: 'from-rose-50 to-pink-50', border: 'border-rose-100/60', text: 'text-rose-700', sub: 'text-rose-300' },
                                    { value: stats.linkedCount, label: '已关联', icon: 'L', gradient: 'from-teal-50 to-emerald-50', border: 'border-teal-100/60', text: 'text-teal-700', sub: 'text-teal-300' },
                                ].map((item, i) => (
                                    <div key={i} className={`bg-gradient-to-br ${item.gradient} rounded-[20px] p-4 border ${item.border}`}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-sm">{item.icon}</span>
                                            <span className={`text-[9px] font-semibold ${item.sub} tracking-wider`}>{item.label}</span>
                                        </div>
                                        <div className={`text-[28px] font-extrabold ${item.text} tracking-tight leading-none`}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            {stats.unscannedCount > 0 && (
                                <div className="mt-3 px-3 py-2 bg-amber-50/80 border border-amber-100 rounded-xl">
                                    <p className="text-[10px] text-amber-600/80 font-medium leading-relaxed">
                                        还有 {stats.unscannedCount} 条记忆尚未完成语义扫描，执行语义分析后会继续补齐候选关系。
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={fetchStats}
                                disabled={loading}
                                className="w-full mt-3 py-2 text-[10px] text-slate-400 font-medium active:text-slate-500 transition-colors disabled:opacity-40"
                            >
                                {loading ? '刷新中...' : '刷新统计'}
                            </button>
                        </section>
                    );
                })()}

                {/* Temporal Backfill */}
                <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm shadow-sm">TB</div>
                        <div>
                            <h3 className="text-[13px] font-bold text-slate-700">时序补链</h3>
                            <p className="text-[9px] text-slate-400">根据记忆时间关系补全前后链接。</p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => doBackfill(true)}
                            disabled={backfilling || !isConnected}
                            className="flex-1 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-[11px] font-semibold text-slate-500 active:scale-[0.97] transition-all disabled:opacity-40"
                        >
                            {backfilling ? <Spinner /> : '预览'}
                        </button>
                        <button
                            onClick={() => setShowConfirm('temporal')}
                            disabled={backfilling || !isConnected}
                            className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl text-[11px] font-bold text-white active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm shadow-amber-200/50"
                        >
                            执行补链
                        </button>
                    </div>

                    {showConfirm === 'temporal' && (
                        <ConfirmBar
                            text={selectedCharId
                                ? `将为 ${charNameMap(selectedCharId)} 执行时序补链。这会写入前后记忆链接并刷新图谱统计，继续吗？`
                                : '将为全部角色执行时序补链。这会写入前后记忆链接并刷新图谱统计，继续吗？'}
                            loading={backfilling}
                            onCancel={() => setShowConfirm(null)}
                            onConfirm={() => doBackfill(false)}
                        />
                    )}
                </section>

                {backfillResult && (
                    <ResultCard
                        title={backfillResult.dryRun ? '时序补链预览' : '时序补链结果'}
                        isDryRun={backfillResult.dryRun}
                        items={(backfillResult.verification || [])
                            .filter(v => !selectedCharId || v.charId === selectedCharId)
                            .map(v => ({
                                name: charNameMap(v.charId),
                                avatar: charAvatarMap(v.charId),
                                count: v.total,
                                status: v.complete ? '已补齐' : `${v.withPrev}/${v.expected} 已补`,
                                complete: v.complete,
                            }))}
                        stats={[
                            { value: backfillResult.totals.memories, label: '记忆' },
                            { value: backfillResult.totals.linksCreated, label: '链接' },
                            { value: backfillResult.totals.edgesCreated, label: '边' },
                        ]}
                        note={backfillResult.dryRun ? '预览模式不会写入后端。' : '执行完成后已刷新统计。'}
                    />
                )}
'''))
tail_parts.append(dedent('''
                {/* Semantic Analysis */}
                <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-sm shadow-sm">SA</div>
                        <div>
                            <h3 className="text-[13px] font-bold text-slate-700">语义分析</h3>
                            <p className="text-[9px] text-slate-400">
                                {selectedCharId ? `为 ${charNameMap(selectedCharId)} 建立语义边。` : '为全部角色补齐缺失的语义边。'}
                            </p>
                        </div>
                    </div>

                    {!hasSubApi && (
                        <div className="mt-2 px-3 py-2.5 bg-violet-50/60 border border-violet-100 rounded-xl">
                            <p className="text-[10px] text-violet-500">未检测到子模型 API Key，语义分析与重建暂时不可用。</p>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <button
                            onClick={() => doSemanticBackfill(true)}
                            disabled={semanticRunning || !isConnected || !hasSubApi}
                            className="flex-1 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-[11px] font-semibold text-slate-500 active:scale-[0.97] transition-all disabled:opacity-40"
                        >
                            {semanticRunning && !semanticRebuilding ? <Spinner /> : '预览'}
                        </button>
                        <button
                            onClick={() => setShowConfirm('semantic')}
                            disabled={semanticRunning || !isConnected || !hasSubApi}
                            className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-2xl text-[11px] font-bold text-white active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm shadow-violet-200/50"
                        >
                            执行分析
                        </button>
                        <button
                            onClick={() => setShowConfirm('semanticRebuild')}
                            disabled={semanticRunning || !isConnected || !hasSubApi || !selectedCharId}
                            className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-orange-500 rounded-2xl text-[11px] font-bold text-white active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm shadow-rose-200/60"
                        >
                            {semanticRebuilding ? <Spinner /> : '重置并重建'}
                        </button>
                    </div>

                    {showConfirm === 'semantic' && (
                        <ConfirmBar
                            text={selectedCharId
                                ? `将为 ${charNameMap(selectedCharId)} 执行语义分析，调用已配置的子模型接口并为缺失语义边的记忆生成候选关系。继续吗？`
                                : '将为全部角色执行语义分析，调用已配置的子模型接口并为缺失语义边的记忆生成候选关系。继续吗？'}
                            loading={semanticRunning}
                            onCancel={() => setShowConfirm(null)}
                            onConfirm={() => doSemanticBackfill(false)}
                            color="violet"
                        />
                    )}

                    {showConfirm === 'semanticRebuild' && selectedCharId && (
                        <ConfirmBar
                            text={`将删除 ${charNameMap(selectedCharId)} 的现有语义边并重新扫描相关记忆。这会再次调用模型，可能耗时较久，继续吗？`}
                            loading={semanticRebuilding}
                            onCancel={() => setShowConfirm(null)}
                            onConfirm={doSemanticRebuild}
                            color="rose"
                        />
                    )}

                    {showConfirm === 'rescan' && (
                        <div className="mt-3 p-3.5 rounded-2xl border bg-emerald-50/60 border-emerald-200/60">
                            <p className="text-[10px] text-emerald-600/80 mb-3 leading-relaxed">
                                当前没有新的待处理记忆，但你仍可以强制重扫并重新生成候选语义边。
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowConfirm(null)}
                                    className="flex-1 py-2 bg-white/80 border border-slate-200 rounded-xl text-[10px] font-semibold text-slate-400"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={() => { setShowConfirm(null); doSemanticBackfill(false, true); }}
                                    disabled={semanticRunning}
                                    className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold disabled:opacity-50"
                                >
                                    强制重扫
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedCharId && semanticRebuildResult?.charId === selectedCharId && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/70">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-bold text-rose-600">重建统计</div>
                                <span className="text-[9px] text-rose-400">最近一次</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: semanticRebuildResult.deleted, label: '删除旧边' },
                                    { value: semanticRebuildResult.reset, label: '重置记忆' },
                                    { value: semanticRebuildResult.toProcess, label: '待重扫' },
                                ].map((item, index) => (
                                    <div key={index} className="bg-white/70 rounded-xl py-2 text-center">
                                        <div className="text-[16px] font-bold text-rose-700">{item.value}</div>
                                        <div className="text-[8px] text-rose-300 font-semibold">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {queueStatus && queueStatus.total > 0 && (
                    <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                        <div className="flex items-center gap-2 mb-3">
                            {queueStatus.running ? (
                                <div className="w-5 h-5 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                            ) : (
                                <span className="text-[10px] font-bold text-violet-500">
                                    {queueStatus.aborted ? '已中止' : queueStatus.done > 0 ? '已完成' : '待处理'}
                                </span>
                            )}
                            <h3 className="text-[13px] font-bold text-slate-700 flex-1">
                                {queueStatus.running
                                    ? queueStatus.mode === 'semantic-rebuild' ? '正在重建语义边...' : '正在分析语义边...'
                                    : queueStatus.aborted
                                        ? '语义任务已中止'
                                        : queueStatus.done > 0
                                            ? queueStatus.mode === 'semantic-rebuild' ? '语义重建完成' : '语义分析完成'
                                            : '语义任务未启动'}
                            </h3>
                            {queueStatus.running && queueStatus.canAbort && (
                                <button
                                    onClick={() => semanticAbortRef.current?.abort()}
                                    className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-500 text-[9px] font-bold border border-rose-100 active:scale-[0.98] transition-transform"
                                >
                                    中止
                                </button>
                            )}
                            <span className="text-[11px] font-bold text-violet-600">
                                {queueStatus.done}/{queueStatus.total}
                            </span>
                        </div>

                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((queueStatus.done / Math.max(1, queueStatus.total)) * 100)}%` }}
                            />
                        </div>

                        <div className="flex justify-between text-[9px] text-slate-400">
                            <span>进度</span>
                            <span>{Math.round((queueStatus.done / Math.max(1, queueStatus.total)) * 100)}%</span>
                        </div>
'''))
tail_parts.append(dedent('''
                        {(queueStatus as any).lastSnippet && (
                            <div className="mt-2 text-[9px] text-slate-400 font-mono break-all">
                                最近片段: {(queueStatus as any).lastSnippet.slice(0, 100)}...
                            </div>
                        )}

                        {(queueStatus as any).lastParseError && (
                            <div className="mt-1 text-[9px] text-red-400 font-mono break-all">
                                解析错误: {(queueStatus as any).lastParseError}
                            </div>
                        )}

                        <div className="mt-1 text-[9px] text-slate-400 font-mono">
                            原始 {(queueStatus as any).lastRawCount ?? '?'} · 过滤 {(queueStatus as any).lastFilterCount ?? '?'} · 候选 {(queueStatus as any).lastCandidateCount ?? '?'}
                            {(queueStatus as any).lastVecSim !== undefined && ` · 向量相似度 ${(queueStatus as any).lastVecSim ? '是' : '否'}`}
                        </div>

                        {queueStatus.aborted && (
                            <div className="mt-3 p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                                <p className="text-[9px] text-rose-500 leading-relaxed">
                                    当前任务已中止，已完成的结果会保留；稍后可以再次执行语义分析或重建继续补齐。
                                </p>
                            </div>
                        )}

                        {queueStatus.lastError && (
                            <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-[11px] font-bold text-amber-700 mb-1">最近错误</p>
                                <p className="text-[9px] text-amber-900 font-mono break-all">{queueStatus.lastError}</p>
                            </div>
                        )}
                    </section>
                )}

                {semanticResult && (() => {
                    const rows = semanticResult.results.filter(item => !selectedCharId || item.charId === selectedCharId);
                    const needEdges = rows.reduce((sum, item) => sum + item.needsEdges, 0);
                    return (
                        <ResultCard
                            title={semanticResult.dryRun ? '语义分析预览' : '语义分析结果'}
                            isDryRun={semanticResult.dryRun}
                            items={rows.map(item => ({
                                name: charNameMap(item.charId),
                                avatar: charAvatarMap(item.charId),
                                count: item.needsEdges,
                                status: semanticResult.dryRun
                                    ? `${item.queued} 条可入队`
                                    : item.queued > 0 ? '已入队' : '无需处理',
                                complete: item.queued === 0,
                            }))}
                            stats={[
                                { value: rows.length, label: '角色' },
                                { value: needEdges, label: '待补边' },
                                { value: semanticResult.totalQueued, label: '已入队' },
                            ]}
                            note={semanticResult.note}
                        />
                    );
                })()}

                {/* Metric Notes */}
                <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-sm shadow-sm">IN</div>
                        <div>
                            <h3 className="text-[13px] font-bold text-slate-700">指标说明</h3>
                            <p className="text-[9px] text-slate-400">帮助你快速判断图谱当前状态。</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { title: '时序边', text: '由时间先后关系生成，适合补齐记忆的前后引用。', tone: 'from-amber-50 to-orange-50 border-amber-100/60 text-amber-700' },
                            { title: '语义边', text: '由模型分析记忆内容生成，适合发现主题、因果与相似关系。', tone: 'from-violet-50 to-fuchsia-50 border-violet-100/60 text-violet-700' },
                            { title: 'L1 记忆', text: '由蒸馏生成的抽象层记忆，用于总结多个相近的 L0 记忆。', tone: 'from-cyan-50 to-teal-50 border-cyan-100/60 text-teal-700' },
                        ].map((item, index) => (
                            <div key={index} className={`bg-gradient-to-r ${item.tone} rounded-2xl border p-3`}>
                                <div className="text-[10px] font-bold mb-1">{item.title}</div>
                                <p className="text-[10px] leading-relaxed opacity-80">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Distillation */}
                <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white text-sm shadow-sm">DS</div>
                        <div>
                            <h3 className="text-[13px] font-bold text-slate-700">记忆蒸馏</h3>
                            <p className="text-[9px] text-slate-400">将相近的 L0 记忆聚合为更高层的 L1 记忆。</p>
                        </div>
                    </div>

                    {!selectedCharId && (
                        <div className="mt-2 px-3 py-2.5 bg-amber-50/60 border border-amber-100 rounded-xl">
                            <p className="text-[10px] text-amber-600">请先选择一个角色，再执行蒸馏。</p>
                        </div>
                    )}

                    {selectedCharId && !hasEmbeddingApi && (
                        <div className="mt-2 px-3 py-2.5 bg-cyan-50/70 border border-cyan-100 rounded-xl">
                            <p className="text-[10px] text-cyan-600">未检测到 embedding API Key，蒸馏暂时不可用。</p>
                        </div>
                    )}

                    {selectedCharId && hasEmbeddingApi && (
                        <>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <button
                                    onClick={() => setShowConfirm('distill')}
                                    disabled={distillBusy || !isConnected}
                                    className="py-3 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl text-[11px] font-bold text-white active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm shadow-cyan-200/50"
                                >
                                    {distilling ? <Spinner /> : '执行蒸馏'}
                                </button>
                                <button
                                    onClick={() => setShowConfirm('distillRebuild')}
                                    disabled={distillBusy || !isConnected}
                                    className="py-3 bg-gradient-to-r from-rose-500 to-orange-500 rounded-2xl text-[11px] font-bold text-white active:scale-[0.97] transition-all disabled:opacity-40 shadow-sm shadow-rose-200/60"
                                >
                                    {distillRebuilding ? <Spinner /> : '重置并执行'}
                                </button>
                            </div>
'''))
tail_parts.append(dedent('''

                            {showConfirm === 'distill' && (
                                <ConfirmBar
                                    text={`将对 ${charNameMap(selectedCharId)} 执行记忆蒸馏，聚合相近记忆并生成 L1 抽象记忆。继续吗？`}
                                    loading={distilling}
                                    onCancel={() => setShowConfirm(null)}
                                    onConfirm={doDistill}
                                    color="amber"
                                />
                            )}

                            {showConfirm === 'distillRebuild' && (
                                <ConfirmBar
                                    text={`将先清空 ${charNameMap(selectedCharId)} 的现有蒸馏结果，再重新运行完整蒸馏。这会删除旧的 L1 和记忆关系后重建，继续吗？`}
                                    loading={distillRebuilding}
                                    onCancel={() => setShowConfirm(null)}
                                    onConfirm={doDistillRebuild}
                                    color="rose"
                                />
                            )}
                        </>
                    )}
                </section>

                {distillResult && (
                    <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-base text-teal-500">RS</span>
                            <h3 className="text-[13px] font-bold text-slate-700 flex-1">蒸馏结果</h3>
                        </div>

                        {selectedCharId && distillResetStats?.charId === selectedCharId && (
                            <div className="mb-3 p-2.5 rounded-xl border border-rose-100 bg-white/70">
                                <div className="text-[9px] font-bold text-rose-500 tracking-wider mb-2">RESET</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: distillResetStats.l1Deleted, label: '删除 L1' },
                                        { value: distillResetStats.l0Cleared, label: '清空 L0' },
                                        { value: distillResetStats.relationsCleared, label: '清空关系' },
                                    ].map((item, index) => (
                                        <div key={index} className="bg-rose-50/70 rounded-xl py-2 text-center">
                                            <div className="text-[14px] font-bold text-rose-700">{item.value}</div>
                                            <div className="text-[8px] text-rose-300 font-semibold">{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {[
                                { value: distillResult.clustersFound, label: '簇数' },
                                { value: distillResult.l1Created, label: '新建 L1' },
                                { value: distillResult.l1Merged || 0, label: '合并 L1' },
                                { value: distillResult.l1Deduped || 0, label: '去重 L1' },
                            ].map((s, i) => (
                                <div key={i} className="bg-white/60 rounded-xl py-2 text-center">
                                    <div className="text-[16px] font-bold text-teal-700">{s.value}</div>
                                    <div className="text-[8px] text-teal-300 font-semibold">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap justify-between gap-2 text-[9px] text-slate-400">
                            <span>L0 已链接 {distillResult.l0Linked}</span>
                            <span>耗时 {(distillResult.elapsed / 1000).toFixed(1)}s</span>
                            {distillResult.errors > 0 && <span className="text-rose-400">错误 {distillResult.errors}</span>}
                        </div>
                    </section>
                )}

                {selectedCharId && (
                    <section className="bg-white/70 backdrop-blur-sm rounded-[24px] shadow-sm border border-white/50 overflow-hidden">
                        <button
                            onClick={() => { if (!browserOpen) fetchBrowserMemories(); setBrowserOpen(!browserOpen); haptic.light(); }}
                            className="w-full flex items-center gap-2.5 p-5 active:bg-slate-50/50 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-sm shadow-sm">MB</div>
                            <div className="text-left flex-1">
                                <h3 className="text-[13px] font-bold text-slate-700">记忆浏览器</h3>
                                <p className="text-[9px] text-slate-400">浏览、编辑和检查该角色的 L0 / L1 记忆与关系。</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${browserOpen ? 'rotate-180' : ''}`}>
                                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {browserOpen && (
                            <div className="px-5 pb-5">
                                <div className="flex gap-1.5 mb-3">
                                    {([
                                        { key: 'all', label: `全部 (${browserCounts.total})` },
                                        { key: '0', label: `L0 (${browserCounts.l0})` },
                                        { key: '1', label: `L1 (${browserCounts.l1})` },
                                    ] as const).map(tab => {
                                        const isActive = browserLevel === tab.key;
                                        return (
                                            <button
                                                key={tab.key}
                                                onClick={() => { setBrowserLevel(tab.key); fetchBrowserMemories(tab.key); haptic.light(); }}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${isActive ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-100/60 text-slate-400'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {browserLoading ? (
                                    <div className="flex justify-center py-6">
                                        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                                    </div>
                                ) : browserMemories && browserMemories.length > 0 ? (
                                    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto no-scrollbar">
                                        {browserMemories.map((m: any) => {
                                            const isExpanded = expandedMemId === m.id;
                                            const createdAt = Number(m.createdAt || 0);
                                            const days = Math.floor(Math.max(0, Date.now() - createdAt) / 86400000);
                                            const timeLabel = days === 0 ? '今天' : days === 1 ? '昨天' : days < 7 ? `${days}天前` : days < 30 ? `${Math.round(days / 7)}周前` : `${Math.round(days / 30)}个月前`;
                                            const sourceCount = Array.isArray(m.sourceMemoryIds) ? m.sourceMemoryIds.length : 0;
                                            const relations = Array.isArray(m.relations) ? m.relations : [];
'''))
tail_parts.append(dedent('''
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`rounded-xl border transition-all ${m.level === 1 ? 'bg-gradient-to-r from-cyan-50/40 to-teal-50/40 border-cyan-100/60' : 'bg-slate-50/60 border-slate-100/60'}`}
                                                >
                                                    <button
                                                        onClick={() => { setExpandedMemId(isExpanded ? null : m.id); haptic.light(); }}
                                                        className="w-full text-left px-3 py-2.5 flex items-start gap-2"
                                                    >
                                                        <span className={`shrink-0 mt-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md ${m.level === 1 ? 'bg-cyan-100 text-cyan-600' : 'bg-slate-100 text-slate-400'}`}>
                                                            {m.level === 1 ? 'L1' : 'L0'}
                                                        </span>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-semibold text-slate-600 truncate">{m.title}</div>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className="text-[9px] text-slate-300">{timeLabel}</span>
                                                                <span className="text-[9px] text-amber-500">重要度 {Number(m.importance || 0)}</span>
                                                                {m.distilledInto && <span className="text-[9px] text-cyan-500">已蒸馏</span>}
                                                                {sourceCount > 0 && <span className="text-[9px] text-teal-500">来源 {sourceCount}</span>}
                                                            </div>
                                                        </div>

                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 text-slate-300 shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="px-3 pb-3 space-y-2">
                                                            {editingMemId === m.id && editDraft ? (
                                                                <div className="space-y-2">
                                                                    <input
                                                                        value={editDraft.title}
                                                                        onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}
                                                                        className="w-full text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-violet-300 outline-none"
                                                                    />
                                                                    <textarea
                                                                        value={editDraft.content}
                                                                        onChange={e => setEditDraft({ ...editDraft, content: e.target.value })}
                                                                        rows={4}
                                                                        className="w-full text-[10px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 resize-none focus:ring-1 focus:ring-violet-300 outline-none leading-relaxed"
                                                                    />
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] text-slate-400">重要度</span>
                                                                        <input
                                                                            type="range"
                                                                            min="1"
                                                                            max="10"
                                                                            value={editDraft.importance}
                                                                            onChange={e => setEditDraft({ ...editDraft, importance: parseInt(e.target.value, 10) })}
                                                                            className="flex-1 h-1 accent-violet-500"
                                                                        />
                                                                        <span className="text-[9px] font-bold text-violet-500">{editDraft.importance}</span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => { setEditingMemId(null); setEditDraft(null); }}
                                                                            className="flex-1 py-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50 rounded-lg"
                                                                        >
                                                                            取消
                                                                        </button>
                                                                        <button
                                                                            onClick={() => doSaveEdit(m.id)}
                                                                            disabled={saving}
                                                                            className="flex-1 py-1.5 text-[10px] font-bold text-white bg-violet-500 rounded-lg disabled:opacity-50"
                                                                        >
                                                                            {saving ? '保存中...' : '保存'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                                                    {m.emotionalJourney && (
                                                                        <p className="text-[9px] text-violet-400 italic">情绪：{m.emotionalJourney}</p>
                                                                    )}
                                                                </>
                                                            )}

                                                            {relations.length > 0 && (
                                                                <div className="pt-1">
                                                                    <div className="text-[8px] font-bold text-slate-400 mb-1">关系</div>
                                                                    <div className="space-y-1">
                                                                        {relations.map((r: any, ri: number) => (
                                                                            <div key={ri} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-white/70 border-slate-100 text-[9px]">
                                                                                <span className="font-bold shrink-0 text-slate-600">{r.relation}</span>
                                                                                <span className="text-slate-300">|</span>
                                                                                <span className="truncate flex-1 text-slate-400">{r.neighborTitle}</span>
                                                                                {r.weight !== undefined && r.weight !== null && <span className="shrink-0 opacity-50">{Number(r.weight).toFixed(1)}</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
'''))
tail_parts.append(dedent('''

                                                            <div className="flex items-center justify-between pt-1 gap-2">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">提及 {Number(m.mentionCount || 0)}</span>
                                                                    <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">salience {Number(m.salienceScore || 0).toFixed(2)}</span>
                                                                    <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">{String(m.id).slice(0, 20)}...</span>
                                                                </div>
                                                                {editingMemId !== m.id && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingMemId(m.id);
                                                                            setEditDraft({ title: m.title || '', content: m.content || '', importance: Number(m.importance || 5) });
                                                                            haptic.light();
                                                                        }}
                                                                        className="shrink-0 text-[9px] font-bold text-violet-400 bg-violet-50 px-2 py-1 rounded-lg active:scale-95 transition-transform"
                                                                    >
                                                                        编辑
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-300 text-center py-4">当前筛选下暂无记忆。</p>
                                )}
                            </div>
                        )}
                    </section>
                )}

                <p className="text-[9px] text-slate-300 text-center pb-8 leading-relaxed tracking-wide">
                    记忆蒸馏 · Cognitive Engine v2
                </p>
            </div>
        </div>
    );
};

const Spinner = () => (
    <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto" />
);

const ConfirmBar: React.FC<{
    text: string; loading: boolean; color?: 'amber' | 'violet' | 'rose';
    onCancel: () => void; onConfirm: () => void;
}> = ({ text, loading, color = 'amber', onCancel, onConfirm }) => {
    const theme = color === 'violet'
        ? {
            panel: 'bg-violet-50/60 border-violet-200/60',
            text: 'text-violet-600/80',
            button: 'bg-violet-500',
        }
        : color === 'rose'
            ? {
                panel: 'bg-rose-50/70 border-rose-200/70',
                text: 'text-rose-600/80',
                button: 'bg-rose-500',
            }
            : {
                panel: 'bg-amber-50/60 border-amber-200/60',
                text: 'text-amber-600/80',
                button: 'bg-amber-500',
            };
    return (
        <div className={`mt-3 p-3.5 rounded-2xl border ${theme.panel}`}>
            <p className={`text-[10px] mb-3 leading-relaxed ${theme.text}`}>{text}</p>
            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 py-2 bg-white/80 border border-slate-200 rounded-xl text-[10px] font-semibold text-slate-400">取消</button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    className={`flex-1 py-2 text-white rounded-xl text-[10px] font-bold disabled:opacity-50 flex items-center justify-center ${theme.button}`}
                >
                    {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '确认'}
                </button>
            </div>
        </div>
    );
};

const ResultCard: React.FC<{
    title: string; isDryRun: boolean;
    items: { name: string; avatar: string; count: number; status: string; complete: boolean }[];
    stats: { value: number; label: string }[];
    note?: string;
}> = ({ title, isDryRun, items, stats, note }) => (
    <section className="bg-white/70 backdrop-blur-sm rounded-[24px] p-5 shadow-sm border border-white/50">
        <div className="flex items-center gap-2 mb-3">
            <span className="text-base text-slate-500">RS</span>
            <h3 className="text-[13px] font-bold text-slate-700 flex-1">{title}</h3>
            {isDryRun && <span className="text-[8px] bg-sky-50 text-sky-500 px-2 py-0.5 rounded-full font-bold tracking-wider">预览</span>}
        </div>

        <div className={`grid ${stats.length >= 4 ? 'grid-cols-2' : 'grid-cols-3'} gap-2 mb-3`}>
            {stats.map((s, i) => (
                <div key={i} className="bg-slate-50/80 rounded-xl py-2 text-center">
                    <div className="text-[16px] font-bold text-slate-700">{s.value}</div>
                    <div className="text-[8px] text-slate-300 font-semibold">{s.label}</div>
                </div>
            ))}
        </div>

        {items.length > 0 && (
            <div className="space-y-1.5">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50/60 rounded-xl px-3 py-2.5 gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            {item.avatar ? (
                                <img src={item.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-[10px]">
                                    {item.name.charAt(0)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-slate-600 truncate">{item.name}</div>
                                <div className="text-[9px] text-slate-300">{item.count} 条</div>
                            </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-lg shrink-0 ${item.complete ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                            {item.status}
                        </span>
                    </div>
                ))}
            </div>
        )}

        {note && <p className="text-[9px] text-slate-300 mt-3 text-center">{note}</p>}
    </section>
);

export default CognitiveNetworkApp;
'''))

new_tail = ''.join(tail_parts).lstrip('\n').splitlines()
lines = lines[:809] + new_tail
p.write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
print(f"rewrote {p}")
