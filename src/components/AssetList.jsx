import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link, Routes, Route } from 'react-router-dom';
import api from '../api';
import AssetCard from './AssetCard';
import AssetViewer from './AssetViewer';

const CATEGORY_MAP = {
  Projects: 'PROJECTS',
  Modules: 'MODULE',
  'Asset Type': 'ASSET TYPE',
  Industry: 'INDUSTRY',
  Environments: 'ENVIRONMENTS',
  Custom: 'CUSTOM'
};

const CATEGORIES_KEYS = Object.keys(CATEGORY_MAP);

export const fetchLabels = async (tenantId) => {
  try {
    const response = await api.get(`/configs/tenant/${tenantId}`);
    if (!response.data || !response.data.data) {
      console.log('No configs data in response');
      return { success: false, labels: {} };
    }
    const labelsGrouped = {};
    response.data.data.forEach((item) => {
      const cat = item.category || 'Custom';
      if (!labelsGrouped[cat]) {
        labelsGrouped[cat] = [];
      }
      labelsGrouped[cat].push({
        configId: item._id || item.id,
        category: item.category,
        labels: item.labels || []
      });
    });
    return { success: true, labels: labelsGrouped };
  } catch (err) {
    console.error('Error fetching labels for tenant:', err);
    return {
      success: false,
      error: err.response?.data?.message || err.message,
      labels: {}
    };
  }
};

const AssetList = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Read cache from sessionStorage
  const cachedDataStr = sessionStorage.getItem('iw_assetGridCache');
  const cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : null;

  const [assets, setAssets] = useState(cachedData?.assets || []);
  const [loading, setLoading] = useState(!cachedData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  
  const [totalCount, setTotalCount] = useState(cachedData?.totalCount || 0);
  const [currentPage, setCurrentPage] = useState(cachedData?.currentPage || 1);
  const [totalPages, setTotalPages] = useState(cachedData?.totalPages || 0);
  
  const [searchQuery, setSearchQuery] = useState(cachedData?.searchQuery || '');
  const [categoriesMap, setCategoriesMap] = useState({});
  const [activeCategories, setActiveCategories] = useState(cachedData?.activeCategories || []);
  const [openDropdownCategory, setOpenDropdownCategory] = useState(null);
  const [selectedLabels, setSelectedLabels] = useState(cachedData?.selectedLabels || []);
  const [selectedType, setSelectedType] = useState(cachedData?.selectedType || '');
  const [availableTypes, setAvailableTypes] = useState([]);
  
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('iw_assetSort') || 'created');
  const [gridSize, setGridSize] = useState(() => {
    const size = localStorage.getItem('iw_assetGridSize');
    return size ? Number(size) : 220;
  });

  const ITEMS_PER_PAGE = 50;
  const observerRef = useRef(null);
  const isFetchingRef = useRef(false);
  const debounceTimeoutRef = useRef(null);

  // Sync sort and size preferences
  useEffect(() => {
    localStorage.setItem('iw_assetSort', sortBy);
    localStorage.setItem('iw_assetGridSize', gridSize);
  }, [sortBy, gridSize]);

  // Load tenant categories / labels
  useEffect(() => {
    const loadLabels = async () => {
      const tenantId = localStorage.getItem('iw_tenantId');
      if (tenantId) {
        const result = await fetchLabels(tenantId);
        if (result.success) {
          setCategoriesMap(result.labels);
        } else {
          console.error('Failed to load labels:', result.error);
        }
      }
    };
    loadLabels();
  }, []);

  // Fetch assets function
  const fetchAssets = useCallback(async (page, searchVal = '', tagsList = [], sortVal = 'created', typeVal = '') => {
    if (isFetchingRef.current) {
      console.log('Already fetching, skipping');
      return;
    }
    
    isFetchingRef.current = true;
    try {
      const tenantId = localStorage.getItem('iw_tenantId');
      if (!tenantId) {
        setError('No tenant selected');
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      if (page > 1) {
        setLoadingMore(true);
      }

      // Map sort preference to API fields
      const sortMapping = {
        created: { by: 'createdAt', order: 'desc' },
        updated: { by: 'updatedAt', order: 'desc' },
        name: { by: 'name', order: 'asc' },
        type: { by: 'assetType', order: 'asc' }
      }[sortVal] || { by: sortVal, order: 'desc' };

      const params = {
        tenantId,
        page,
        limit: ITEMS_PER_PAGE,
        sortBy: sortMapping.by,
        sortOrder: sortMapping.order
      };

      if (searchVal) params.search = searchVal;
      if (tagsList.length > 0) params.tags = tagsList.join(',');
      if (typeVal) params.assetType = typeVal;

      console.log(`Fetching page ${page} with params:`, params);
      const response = await api.get('/assets', { params });
      
      const newAssets = response.data.data || [];
      const pagination = response.data.pagination || {};

      setAssets((prev) => {
        if (page === 1) return newAssets;
        
        const existingIds = new Set(prev.map(a => a.assetId || a.id || a._id));
        const filteredNew = newAssets.filter(a => !existingIds.has(a.assetId || a.id || a._id));
        return [...prev, ...filteredNew];
      });

      setCurrentPage(page);
      setTotalPages(pagination.pages || 0);
      setTotalCount(pagination.total || 0);
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, []);

  const searchParamsRef = useRef({
    searchQuery,
    selectedLabels,
    sortBy,
    selectedType,
    activeCategories
  });

  // Handle updates to search/filters with debounce
  useEffect(() => {
    const hasSearchChanged =
      searchQuery !== searchParamsRef.current.searchQuery ||
      JSON.stringify(selectedLabels) !== JSON.stringify(searchParamsRef.current.selectedLabels) ||
      sortBy !== searchParamsRef.current.sortBy ||
      selectedType !== searchParamsRef.current.selectedType ||
      JSON.stringify(activeCategories) !== JSON.stringify(searchParamsRef.current.activeCategories);

    if (!hasSearchChanged) {
      if (cachedData && cachedData.assets && cachedData.assets.length > 0) return;
      if (assets.length === 0) {
        fetchAssets(1, searchQuery, selectedLabels, sortBy, selectedType);
      }
      return;
    }

    searchParamsRef.current = {
      searchQuery,
      selectedLabels,
      sortBy,
      selectedType,
      activeCategories
    };

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchAssets(1, searchQuery, selectedLabels, sortBy, selectedType);
    }, 500);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedLabels, sortBy, selectedType, activeCategories, fetchAssets]);

  // Handle scrolling restoration
  const scrollPosRef = useRef(cachedData?.scrollPos || 0);
  
  useEffect(() => {
    if (cachedData?.scrollPos) {
      const restoreScroll = () => {
        const grid = document.querySelector('.asset-grid');
        if (grid) {
          grid.scrollTop = cachedData.scrollPos;
          scrollPosRef.current = cachedData.scrollPos;
        }
      };
      requestAnimationFrame(restoreScroll);
      setTimeout(restoreScroll, 50);
      setTimeout(restoreScroll, 150);
      setTimeout(restoreScroll, 500);
    }
  }, []);

  // Save state cache on scroll
  useEffect(() => {
    const grid = document.querySelector('.asset-grid');
    
    const saveCache = () => {
      const scrollPos = scrollPosRef.current;
      const cacheState = {
        assets,
        currentPage,
        totalPages,
        totalCount,
        searchQuery,
        selectedLabels,
        selectedType,
        activeCategories,
        scrollPos
      };
      sessionStorage.setItem('iw_assetGridCache', JSON.stringify(cacheState));
      window.dispatchEvent(new Event('iw_assetGridCache_updated'));
    };

    if (assets.length > 0) {
      saveCache();
    }

    let saveTimeout;
    const handleScroll = (e) => {
      scrollPosRef.current = e.target.scrollTop;
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveCache, 200);
    };

    if (grid) {
      grid.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        grid.removeEventListener('scroll', handleScroll);
        if (saveTimeout) clearTimeout(saveTimeout);
      };
    }
  }, [assets, currentPage, totalPages, totalCount, searchQuery, selectedLabels, selectedType, activeCategories]);

  // Handle routing parameters (e.g. project URL filter)
  useEffect(() => {
    const projectUrlFilter = new URLSearchParams(location.search).get('project');
    if (projectUrlFilter) {
      console.log('Applying project filter from URL:', projectUrlFilter);
      navigate(location.pathname, { replace: true });
      
      setActiveCategories((prev) => (prev.includes('Projects') ? prev : [...prev, 'Projects']));
      setSelectedLabels((prev) =>
        prev.includes(projectUrlFilter) ? prev.filter(x => x !== projectUrlFilter) : [...prev, projectUrlFilter]
      );
    }
  }, [location.search, navigate, location.pathname]);

  const handleLabelToggle = (label) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
    );
  };

  // Derive unique asset types for filters
  useEffect(() => {
    const typesSet = new Set();
    assets.forEach((a) => {
      if (a.assetType) typesSet.add(a.assetType);
    });
    setAvailableTypes(Array.from(typesSet).sort());
  }, [assets]);

  const getCategoryLabels = (category) => {
    if (!category) return [];
    
    if (category === 'Modules') {
      const projectsConfigs = categoriesMap[CATEGORY_MAP.Projects] || [];
      const modulesSet = new Set();
      
      projectsConfigs.forEach((proj) => {
        (proj.labels || []).forEach((label) => {
          if (label) modulesSet.add(label);
        });
      });
      
      const filteredSelectedProjects = selectedLabels.filter(label => modulesSet.has(label));
      const finalModulesSet = new Set();
      
      if (filteredSelectedProjects.length > 0) {
        filteredSelectedProjects.forEach((projLabel) => {
          (categoriesMap[projLabel] || []).forEach((moduleObj) => {
            (moduleObj.labels || []).forEach((mLabel) => {
              if (mLabel) finalModulesSet.add(mLabel);
            });
          });
        });
      } else {
        modulesSet.forEach((projLabel) => {
          (categoriesMap[projLabel] || []).forEach((moduleObj) => {
            (moduleObj.labels || []).forEach((mLabel) => {
              if (mLabel) finalModulesSet.add(mLabel);
            });
          });
        });
      }
      return Array.from(finalModulesSet).sort();
    }
    
    const catDbKey = CATEGORY_MAP[category];
    if (!categoriesMap[catDbKey]) return [];
    
    const uniqueLabels = new Set();
    categoriesMap[catDbKey].forEach((configItem) => {
      if (configItem.labels && Array.isArray(configItem.labels)) {
        configItem.labels.forEach((lbl) => {
          if (lbl) uniqueLabels.add(lbl);
        });
      }
    });
    return Array.from(uniqueLabels).sort();
  };

  const handleCategoryRemove = (category) => {
    setActiveCategories((prev) => prev.filter(x => x !== category));
    if (openDropdownCategory === category) {
      setOpenDropdownCategory(null);
    }
    const catLabels = getCategoryLabels(category);
    setSelectedLabels((prev) => prev.filter(x => !catLabels.includes(x)));
  };

  // Setup infinite scroll observer
  useEffect(() => {
    if (currentPage >= totalPages) {
      console.log('All pages loaded, stopping scroll observer');
      return;
    }

    const options = {
      root: document.querySelector('.asset-grid'),
      rootMargin: '1500px',
      threshold: 0.1
    };

    const handleIntersection = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isFetchingRef.current && currentPage < totalPages) {
        fetchAssets(currentPage + 1, searchQuery, selectedLabels, sortBy, selectedType);
      }
    };

    const observer = new IntersectionObserver(handleIntersection, options);
    observerRef.current = observer;

    const scrollTarget = document.getElementById('infinite-scroll-target');
    if (scrollTarget) {
      observer.observe(scrollTarget);
    }

    return () => observer.disconnect();
  }, [currentPage, totalPages, searchQuery, selectedLabels, sortBy, selectedType, fetchAssets]);

  if (loading) {
    return <div className="asset-loading">Loading assets...</div>;
  }

  if (error) {
    return <div className="asset-error">{error}</div>;
  }

  return (
    <div className="asset-list-container">
      <div className="asset-list-header">
        <h1>
          Assets <span className="asset-count">{totalCount} items</span>
        </h1>
      </div>
      
      <div className="asset-controls-wrapper">
        <div className="asset-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search assets by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="sort-box">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="created">Created (Newest)</option>
              <option value="updated">Updated (Newest)</option>
              <option value="name">Name (A-Z)</option>
              <option value="type">Type</option>
            </select>
          </div>
          
          {availableTypes.length > 0 && (
            <div className="type-filter">
              <label>Type:</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="type-select"
              >
                <option value="">All Types</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid-size-control">
            <label>Grid Size:</label>
            <input
              type="range"
              min="180"
              max="400"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="grid-size-slider"
            />
          </div>
        </div>

        <div className="label-filter-container">
          <div className="label-category-box">
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !activeCategories.includes(val)) {
                  setActiveCategories((prev) => [...prev, val]);
                  setOpenDropdownCategory(val);
                }
              }}
              className="category-select"
              style={{ minWidth: '160px' }}
            >
              <option value="">Category</option>
              {CATEGORIES_KEYS.map((cat) => (
                <option key={cat} value={cat} disabled={activeCategories.includes(cat)}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {activeCategories.length > 0 && (
            <div className="active-category-chips">
              {activeCategories.map((category) => {
                const labels = getCategoryLabels(category);
                const activeCountInCat = labels.filter(lbl => selectedLabels.includes(lbl)).length;
                
                return (
                  <div
                    key={category}
                    className="category-chip-wrapper"
                    onMouseLeave={() => setOpenDropdownCategory(null)}
                  >
                    <div
                      className={`category-chip ${openDropdownCategory === category ? 'open' : ''} ${
                        activeCountInCat > 0 ? 'has-selection' : ''
                      }`}
                      onClick={() => setOpenDropdownCategory(openDropdownCategory === category ? null : category)}
                    >
                      <span className="chip-name">
                        {category} {activeCountInCat > 0 ? `(${activeCountInCat})` : ''}
                      </span>
                      <span
                        className="chip-remove"
                        title={`Remove ${category} filter`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryRemove(category);
                        }}
                      >
                        ×
                      </span>
                    </div>

                    {openDropdownCategory === category && (
                      <div className="category-labels-dropdown">
                        <div className="dropdown-glass-container">
                          <div className="dropdown-options">
                            {labels.map((label) => (
                              <label
                                key={label}
                                className="dropdown-checkbox-label"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedLabels.includes(label)}
                                  onChange={() => handleLabelToggle(label)}
                                />
                                <span className="checkbox-text">{label}</span>
                              </label>
                            ))}
                            {labels.length === 0 && (
                              <span className="dropdown-empty">No labels found</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="asset-grid" style={{ '--grid-item-size': `${gridSize}px` }}>
        {assets.length === 0 && (
          <div className="asset-empty">No assets align with these filters</div>
        )}
        
        {assets.map((asset, index) => {
          const aId = asset.assetId || asset.id || asset._id;
          return (
            <Link
              key={aId}
              to={`/assets/${aId}`}
              className="asset-link"
              style={{
                animation: `fadeUp 0.5s ease-out ${(index % ITEMS_PER_PAGE) * 0.03}s both`
              }}
            >
              <AssetCard asset={asset} />
            </Link>
          );
        })}
        
        <div id="infinite-scroll-target" className="infinite-scroll-target">
          {loadingMore && <div className="asset-loading-more">Loading more assets...</div>}
          {currentPage >= totalPages && currentPage > 1 && (
            <div className="asset-end">No more assets</div>
          )}
        </div>
      </div>

      {/* Render slide-over pane if a nested route matches assetId */}
      <Routes>
        <Route path=":assetId" element={<AssetViewer isOverlay />} />
      </Routes>
    </div>
  );
};

export default AssetList;
