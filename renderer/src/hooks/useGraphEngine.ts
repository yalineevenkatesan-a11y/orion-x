import { useState, useMemo, useCallback } from 'react';

export type FilterMode = 'ALL' | 'ANY';

export interface GraphCriteria {
  view: string[];
  health: string[];
  risk: string[];
  nodeType: string[];
  fileType: string[];
  aiIssues: string[];
  gitStatus: string[];
  complexityThreshold: number;
}

export function useGraphEngine(initialNodes: any[], initialLinks: any[]) {
  const [search, setSearch] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  
  const [criteria, setCriteria] = useState<GraphCriteria>({
    view: [],
    health: [],
    risk: [],
    nodeType: [],
    fileType: [],
    aiIssues: [],
    gitStatus: [],
    complexityThreshold: 0,
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [blastRadiusActive, setBlastRadiusActive] = useState(false);
  
  const [visibilitySettings, setVisibilitySettings] = useState({
    showLabels: true,
    showConnections: true,
    showFolders: true,
    hideUnmatched: false,
  });

  // Helper to check if a node matches the active criteria
  const checkNodeMatchesCriteria = useCallback((node: any) => {
    let matchesView = true;
    let matchesHealth = true;
    let matchesRisk = true;
    let matchesType = true;
    let matchesExt = true;

    if (criteria.view.length > 0) {
      if (criteria.view.includes('Files') && node.isDir) matchesView = false;
      if (criteria.view.includes('Folders') && !node.isDir) matchesView = false;
    }

    if (criteria.health.length > 0) {
      if (!criteria.health.includes(node.health)) matchesHealth = false;
    }

    if (criteria.risk.length > 0) {
      if (!criteria.risk.includes(node.risk)) matchesRisk = false;
    }

    if (criteria.fileType.length > 0) {
      const ext = node.label ? '.' + node.label.split('.').pop() : '';
      if (!criteria.fileType.includes(ext)) matchesExt = false;
    }

    if (filterMode === 'ALL') {
      return matchesView && matchesHealth && matchesRisk && matchesType && matchesExt;
    } else {
      // ANY
      return (
        (criteria.view.length > 0 && matchesView) ||
        (criteria.health.length > 0 && matchesHealth) ||
        (criteria.risk.length > 0 && matchesRisk) ||
        (criteria.fileType.length > 0 && matchesExt)
      ) || (
        criteria.view.length === 0 && criteria.health.length === 0 && criteria.risk.length === 0 && criteria.fileType.length === 0
      );
    }
  }, [criteria, filterMode]);

  // Compute blast radius
  const getBlastRadius = useCallback((centerNodeId: string | null) => {
    const affected = new Set<string>();
    if (!centerNodeId) return affected;
    
    // Naive blast radius (depth 2 for demo if no backend dependencies exist yet)
    affected.add(centerNodeId);
    initialLinks.forEach(l => {
      if (l.source === centerNodeId || l.source?.id === centerNodeId) affected.add(l.target?.id || l.target);
      if (l.target === centerNodeId || l.target?.id === centerNodeId) affected.add(l.source?.id || l.source);
    });
    return affected;
  }, [initialLinks]);

  const blastRadiusNodes = useMemo(() => getBlastRadius(selectedNodeId), [getBlastRadius, selectedNodeId]);

  const filteredData = useMemo(() => {
    const searchLower = search.toLowerCase();
    
    const nodes = initialNodes.map(node => {
      let isMatch = true;

      // 1. Check Search
      if (searchLower) {
        if (!node.label?.toLowerCase().includes(searchLower) && !node.path?.toLowerCase().includes(searchLower)) {
          isMatch = false;
        }
      }

      // 2. Check Criteria
      if (isMatch) {
        isMatch = checkNodeMatchesCriteria(node);
      }

      // Determine highlight state
      let state = 'UNMATCHED';
      if (isMatch) state = 'SEARCH_MATCH';
      if (blastRadiusActive && blastRadiusNodes.has(node.id)) state = 'RELATED';
      if (selectedNodeId === node.id) state = 'SELECTED';

      // If unmatched, check if we hide it completely
      if (state === 'UNMATCHED' && visibilitySettings.hideUnmatched) {
        state = 'HIDDEN';
      }

      return { ...node, engineState: state };
    }).filter(n => n.engineState !== 'HIDDEN');

    // Filter links based on visible nodes
    const visibleIds = new Set(nodes.map(n => n.id));
    const links = initialLinks.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return visibleIds.has(sourceId) && visibleIds.has(targetId);
    });

    return { nodes, links };
  }, [initialNodes, initialLinks, search, checkNodeMatchesCriteria, selectedNodeId, blastRadiusActive, blastRadiusNodes, visibilitySettings.hideUnmatched]);

  const globalAggregates = useMemo(() => {
    let healthCritical = 0, healthWarning = 0, healthHealthy = 0;
    
    filteredData.nodes.forEach(n => {
      if (n.health === 'critical') healthCritical++;
      else if (n.health === 'warning') healthWarning++;
      else healthHealthy++;
    });

    return {
      totalNodes: initialNodes.length,
      visibleNodes: filteredData.nodes.length,
      totalEdges: initialLinks.length,
      visibleEdges: filteredData.links.length,
      healthCounts: { critical: healthCritical, warning: healthWarning, healthy: healthHealthy }
    };
  }, [filteredData, initialNodes.length, initialLinks.length]);

  const toggleCriteria = (category: keyof GraphCriteria, value: string) => {
    setCriteria(prev => {
      const arr = prev[category] as string[];
      if (arr.includes(value)) {
        return { ...prev, [category]: arr.filter(v => v !== value) };
      } else {
        return { ...prev, [category]: [...arr, value] };
      }
    });
  };

  const clearAllFilters = () => {
    setCriteria({
      view: [], health: [], risk: [], nodeType: [], fileType: [], aiIssues: [], gitStatus: [], complexityThreshold: 0
    });
    setSearch('');
  };

  return {
    search, setSearch,
    activeSearchIndex, setActiveSearchIndex,
    filterMode, setFilterMode,
    criteria: criteria || { view: [], health: [], risk: [], nodeType: [], fileType: [], aiIssues: [], gitStatus: [], complexityThreshold: 0 },
    toggleCriteria, clearAllFilters,
    selectedNodeId, setSelectedNodeId,
    focusNodeId, setFocusNodeId,
    blastRadiusActive, setBlastRadiusActive,
    visibilitySettings, setVisibilitySettings,
    filteredData: {
      nodes: Array.isArray(filteredData?.nodes) ? filteredData.nodes : [],
      links: Array.isArray(filteredData?.links) ? filteredData.links : []
    },
    globalAggregates
  };
}