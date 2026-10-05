import React, { useState } from 'react';
import { Network, AlertTriangle, Building, User, CreditCard, MapPin } from 'lucide-react';
import { GraphPayload, GraphNode } from '../types';
import { ArcTexture } from './Brand';

interface GraphViewerProps {
  graphData: GraphPayload;
}

export const GraphViewer: React.FC<GraphViewerProps> = ({ graphData }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

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
    <div className="card-premium p-6 space-y-4 animate-rise">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Network className="w-4 h-4 text-brass-light" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">Interactive Relationship Graph</h3>
            <p className="text-[11px] text-stonewarm">NetworkX Graph Intelligence & Fraud Ring Detection</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-brown-600 font-medium bg-cream-100 px-3.5 py-2 rounded-xl border border-cream-300">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-olive-600"></span> Focal Supplier</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brown-500"></span> Director</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold"></span> Sister Entity</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stonewarm"></span> Bank Account</span>
        </div>
      </div>

      {/* Anomaly signals */}
      {graphData.summary.network_signals.map((sig, idx) => (
        <div key={idx} className="p-3.5 rounded-xl bg-[#F5ECD6] border border-brass/45 flex items-start gap-3 text-xs animate-fade">
          <AlertTriangle className="w-4 h-4 text-gold-deep shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-gold-deep">{sig.message}</span>
            {sig.details && <p className="text-brown-600 mt-0.5">{sig.details}</p>}
          </div>
        </div>
      ))}

      {/* Graph canvas */}
      <div className="relative min-h-[340px] bg-gradient-to-b from-cream-100 to-cream-200 rounded-2xl border border-cream-300 p-6 flex flex-col justify-between overflow-hidden">
        <ArcTexture className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute top-3 right-4 text-[10px] text-stonewarm font-mono z-10">
          Nodes: {graphData.summary.total_nodes} | Edges: {graphData.summary.total_edges}
        </div>

        {/* Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 z-10 mt-6">
          {graphData.nodes.map((node, idx) => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 animate-rise hover:-translate-y-0.5 ${
                selectedNode?.id === node.id
                  ? 'border-brass bg-linen shadow-brass'
                  : 'border-cream-300 bg-linen/85 hover:border-olive-400/60 hover:shadow-card'
              }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getNodeIcon(node.node_type)}
                  <span className="text-xs font-bold text-espresso truncate max-w-[140px]">{node.label}</span>
                </div>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-semibold bg-cream-200 border border-cream-300 text-brown-600">
                  {node.node_type}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Edges */}
        <div className="mt-5 pt-3.5 border-t border-cream-300 flex flex-wrap gap-2 text-[11px] font-mono z-10">
          <span className="text-stonewarm">Connections:</span>
          {graphData.edges.map((edge, idx) => (
            <span key={idx} className="bg-linen px-2.5 py-1 rounded-lg border border-cream-300 text-brown-700 shadow-panel">
              {edge.source} ➔ <span className="text-olive-700 font-semibold">{edge.relation}</span> ➔ {edge.target}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
