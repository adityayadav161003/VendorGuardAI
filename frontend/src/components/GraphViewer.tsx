import React, { useState, useMemo, useRef } from 'react';
import {
  Network,
  AlertTriangle,
  Building,
  User,
  CreditCard,
  MapPin,
  Filter,
  Download,
  Info,
  Maximize2,
  Box,
  Layers,
  X,
} from 'lucide-react';
import { GraphPayload, GraphNode, GraphEdge } from '../types';
import { ArcTexture } from './Brand';
import { Network3D } from './three/Network3D';

interface GraphViewerProps {
  graphData: GraphPayload;
}

export const GraphViewer: React.FC<GraphViewerProps> = ({ graphData }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Collect distinct relations
  const relationTypes = useMemo(() => {
    const set = new Set<string>();
    graphData.edges.forEach(e => set.add(e.relation));
    return ['ALL', ...Array.from(set)];
  }, [graphData.edges]);

  // Connected nodes when a node is clicked
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return null;
    const ids = new Set<string>([selectedNode.id]);
    graphData.edges.forEach(e => {
      if (e.source === selectedNode.id) ids.add(e.target);
      if (e.target === selectedNode.id) ids.add(e.source);
    });
    return ids;
  }, [selectedNode, graphData.edges]);

  // Filtered edges & nodes based on relation type and selected subgraph
  const filteredEdges = useMemo(() => {
    return graphData.edges.filter(e => {
      const matchRelation = selectedRelation === 'ALL' || e.relation === selectedRelation;
      if (!matchRelation) return false;
      if (connectedNodeIds) {
        return connectedNodeIds.has(e.source) && connectedNodeIds.has(e.target);
      }
      return true;
    });
  }, [graphData.edges, selectedRelation, connectedNodeIds]);

  const filteredNodes = useMemo(() => {
    if (connectedNodeIds) {
      return graphData.nodes.filter(n => connectedNodeIds.has(n.id));
    }
    if (selectedRelation === 'ALL') return graphData.nodes;
    const activeIds = new Set<string>();
    filteredEdges.forEach(e => {
      activeIds.add(e.source);
      activeIds.add(e.target);
    });
    return graphData.nodes.filter(n => activeIds.has(n.id));
  }, [graphData.nodes, connectedNodeIds, selectedRelation, filteredEdges]);

  // Export image handler (downloads SVG or structured snapshot)
  const handleExportImage = () => {
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:#FAF7EE;font-family:sans-serif;">
        <text x="30" y="40" font-size="18" font-weight="bold" fill="#2B2118">VendorGuard AI — Relationship Graph</text>
        <text x="30" y="65" font-size="12" fill="#6E5835">Supplier ID: ${graphData.supplier_id} · Nodes: ${filteredNodes.length} · Edges: ${filteredEdges.length}</text>
        ${filteredNodes.map((n, i) => `
          <g transform="translate(${(i % 4) * 180 + 50}, ${Math.floor(i / 4) * 120 + 100})">
            <rect width="160" height="60" rx="8" fill="#FFF" stroke="#C29B4A" stroke-width="1.5"/>
            <text x="10" y="25" font-size="12" font-weight="bold" fill="#2B2118">${n.label.slice(0, 18)}</text>
            <text x="10" y="45" font-size="10" fill="#6E5835">${n.node_type}</text>
          </g>
        `).join('')}
      </svg>
    `;
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendorguard-graph-${graphData.supplier_id}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'SUPPLIER':
        return <Building className="w-4 h-4 text-olive-600" />;
      case 'DIRECTOR':
        return <User className="w-4 h-4 text-brown-500" />;
      case 'RELATED_ENTITY':
        return <Building className="w-4 h-4 text-gold-deep" />;
      case 'BANK_ACCOUNT':
        return <CreditCard className="w-4 h-4 text-stonewarm-deep" />;
      default:
        return <MapPin className="w-4 h-4 text-sage-deep" />;
    }
  };

  return (
    <div className="card-premium p-6 space-y-5 animate-rise shadow-panel" ref={graphContainerRef}>
      {/* ── Top Bar: Title, Relation Filter, 3D Toggle & Export ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-espresso flex items-center justify-center shadow-panel text-brass-light">
            <Network className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              Interactive Relationship Graph
            </h3>
            <p className="text-[11px] text-stonewarm">
              NetworkX Graph Intelligence · Multi-Entity Affiliations & Advisory Signals
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Relation filter */}
          <div className="flex items-center gap-1 bg-cream-100 px-2.5 py-1.5 rounded-xl border border-cream-300 text-xs">
            <Filter className="w-3 h-3 text-stonewarm" />
            <span className="text-[11px] text-brown-600 font-medium">Relation:</span>
            <select
              value={selectedRelation}
              onChange={e => setSelectedRelation(e.target.value)}
              className="bg-transparent border-0 text-xs font-semibold text-espresso focus:outline-none cursor-pointer"
            >
              {relationTypes.map(r => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* 2D / 3D Toggle */}
          <div className="flex items-center bg-cream-150 p-1 rounded-xl border border-cream-300 text-xs">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === '2d' ? 'bg-espresso text-cream-50' : 'text-brown-700'
              }`}
            >
              2D Matrix
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === '3d' ? 'bg-espresso text-cream-50' : 'text-brown-700'
              }`}
            >
              <Box className="w-3 h-3" /> 3D Orbit
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={handleExportImage}
            className="btn-ghost !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
            title="Export relationship graph image"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Graph</span>
          </button>
        </div>
      </div>

      {/* ── Soft Advisory Wording Banner ─────────────────── */}
      {graphData.summary.network_signals.map((sig, idx) => (
        <div
          key={idx}
          className="p-3.5 rounded-xl bg-[#FBF3DC] border border-brass/45 flex items-start gap-3 text-xs animate-fade"
        >
          <AlertTriangle className="w-4 h-4 text-gold-deep shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gold-deep">
                Soft Advisory: {sig.message}
              </span>
              <span className="badge-warning !text-[9.5px]">Review Recommended</span>
            </div>
            <p className="text-brown-700 mt-1 leading-relaxed">
              Shared attribute detected across entity records. VendorGuard guidelines strictly prohibit
              inferring collusion or fraud from an isolated shared director or registered address.
              Manual confirmation of corporate relationship is recommended.
            </p>
          </div>
        </div>
      ))}

      {/* ── Graph Visualization Area ─────────────────────── */}
      {viewMode === '3d' ? (
        <div className="h-[460px] rounded-2xl border border-cream-300 overflow-hidden relative shadow-panel bg-espresso">
          <Network3D
            payload={graphData}
            selectedId={selectedNode ? selectedNode.id : null}
            onSelectNode={id => {
              const node = graphData.nodes.find(n => n.id === id);
              if (node) setSelectedNode(node);
            }}
          />
          <div className="absolute top-3 left-3 bg-espresso/80 backdrop-blur-xs text-cream-200 text-[11px] px-3 py-1.5 rounded-xl border border-brown-700">
            Interactive 3D Orbit: Click and drag to rotate, scroll to zoom
          </div>
        </div>
      ) : (
        <div className="relative min-h-[380px] bg-gradient-to-b from-cream-100 to-cream-200 rounded-2xl border border-cream-300 p-6 flex flex-col justify-between overflow-hidden shadow-panel">
          <ArcTexture className="absolute inset-0 w-full h-full pointer-events-none opacity-40" />

          {/* Stats strip */}
          <div className="flex items-center justify-between text-[11px] text-brown-600 font-mono z-10 pb-2 border-b border-cream-300">
            <span>
              Showing: {filteredNodes.length} / {graphData.summary.total_nodes} entities · {filteredEdges.length} connections
            </span>
            {selectedNode && (
              <button
                onClick={() => setSelectedNode(null)}
                className="flex items-center gap-1 text-terracotta-deep font-bold hover:underline cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear Selection Filter
              </button>
            )}
          </div>

          {/* Nodes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 z-10 my-4">
            {filteredNodes.map((node, idx) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(isSelected ? null : node)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 animate-rise hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-brass bg-linen shadow-brass ring-2 ring-brass/60'
                      : 'border-cream-300 bg-linen/90 hover:border-olive-400 hover:shadow-card'
                  }`}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.node_type)}
                      <div>
                        <span className="text-xs font-bold text-espresso block truncate max-w-[150px]">
                          {node.label}
                        </span>
                        <span className="text-[10px] text-stonewarm font-mono">
                          id: {node.id.slice(0, 10)}…
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-semibold bg-cream-200 border border-cream-300 text-brown-700">
                      {node.node_type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edges List */}
          <div className="pt-3 border-t border-cream-300 flex flex-wrap gap-2 text-[11px] font-mono z-10">
            <span className="text-stonewarm">Filtered Edges:</span>
            {filteredEdges.map((edge, idx) => (
              <span
                key={idx}
                className="bg-linen px-2.5 py-1 rounded-lg border border-cream-300 text-brown-800 shadow-xs"
              >
                {edge.source} ➔ <span className="text-olive-800 font-semibold">{edge.relation}</span> ➔ {edge.target}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
