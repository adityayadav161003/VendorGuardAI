import React, { useState } from 'react';
import { Network, AlertTriangle, Layers, Building, User, CreditCard, MapPin } from 'lucide-react';
import { GraphPayload, GraphNode } from '../types';

interface GraphViewerProps {
  graphData: GraphPayload;
}

export const GraphViewer: React.FC<GraphViewerProps> = ({ graphData }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'SUPPLIER':
        return <Building className="w-4 h-4 text-blue-400" />;
      case 'DIRECTOR':
        return <User className="w-4 h-4 text-purple-400" />;
      case 'RELATED_ENTITY':
        return <Building className="w-4 h-4 text-amber-400" />;
      case 'BANK_ACCOUNT':
        return <CreditCard className="w-4 h-4 text-cyan-400" />;
      default:
        return <MapPin className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Interactive Relationship Graph
            </h3>
            <p className="text-[11px] text-slate-400">
              NetworkX Graph Intelligence & Fraud Ring Detection
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium bg-[#0d1424] px-3 py-1.5 rounded-lg border border-[#1e293b]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Focal Supplier</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Director</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Sister Entity</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Bank Account</span>
        </div>
      </div>

      {/* Network Anomaly Signal Alert */}
      {graphData.summary.network_signals.map((sig, idx) => (
        <div key={idx} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">{sig.message}</span>
            {sig.details && <p className="text-slate-300 mt-0.5">{sig.details}</p>}
          </div>
        </div>
      ))}

      {/* Visual Canvas / Graph Node Map */}
      <div className="relative min-h-[340px] bg-[#0d1424] rounded-xl border border-[#1e293b] p-6 flex flex-col justify-between overflow-hidden">
        <div className="absolute top-2 right-2 text-[10px] text-slate-500 font-mono">
          Nodes: {graphData.summary.total_nodes} | Edges: {graphData.summary.total_edges}
        </div>

        {/* Nodes Grid Representation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 z-10">
          {graphData.nodes.map(node => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedNode?.id === node.id
                  ? 'border-blue-500 bg-blue-950/40 shadow-md shadow-blue-500/10'
                  : 'border-[#233252] bg-[#131b2e]/80 hover:bg-[#1a243d]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getNodeIcon(node.node_type)}
                  <span className="text-xs font-bold text-white truncate max-w-[140px]">{node.label}</span>
                </div>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-semibold bg-[#1e293b] text-slate-300">
                  {node.node_type}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Relationship Edges Summary */}
        <div className="mt-4 pt-3 border-t border-[#1e293b] flex flex-wrap gap-2 text-[11px] text-slate-400 font-mono">
          <span className="text-slate-500">Connections:</span>
          {graphData.edges.map((edge, idx) => (
            <span key={idx} className="bg-[#131b2e] px-2 py-0.5 rounded border border-[#233252] text-slate-300">
              {edge.source} ➔ <span className="text-blue-400">{edge.relation}</span> ➔ {edge.target}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Graph visualizer
