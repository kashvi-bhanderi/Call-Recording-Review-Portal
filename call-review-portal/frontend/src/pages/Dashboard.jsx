import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./Dashboard.css";
import DashboardHeader from "../components/DashboardHeader";
import MiniAudioPlayer from "../components/MiniAudioPlayer";
import StarRating from "../components/starrating";
import toast from "react-hot-toast";

const Dashboard = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [totalCallCount, setTotalCallCount] = useState(0);

  const savedOrg = localStorage.getItem("selectedOrg") || "";
  const savedTemplate = localStorage.getItem("selectedTemplate") || "";
  const savedOrgName = localStorage.getItem("selectedOrgName") || savedOrg;
  const savedTemplateName =
    localStorage.getItem("selectedTemplateName") || `Template ${savedTemplate}`;

  const PAGE_SIZE = 8;
  const DEFAULT_SORT = "-attempt_on_time_stamp";

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(
    Number(searchParams.get("page")) > 0 ? Number(searchParams.get("page")) : 1
  );
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || DEFAULT_SORT);

  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [prevPageUrl, setPrevPageUrl] = useState(null);
  const [entityKeys, setEntityKeys] = useState([]);
  const [entityValueOptions, setEntityValueOptions] = useState({});

  const [filterOptions, setFilterOptions] = useState({
    languages: [],
    statuses: [],
    rated_by: [],
    tags: [],
  });

  const [filters, setFilters] = useState({
    template_id: savedTemplate,
    phone_number: "",
    uuid: "",
    language: [],
    schema_name: savedOrg ? [savedOrg] : [],
    status: [],
    created_after: "",
    created_before: "",
    rated_by: "",
    tags: [],
    entity_filters: [],
  });

  const [audioMap, setAudioMap] = useState({});
  const [rowData, setRowData] = useState({});
  const [submittingMap, setSubmittingMap] = useState({});

  /* ================= URL HELPERS ================= */
  const buildSearchParamsFromState = (filtersData, pageData, sortData) => {
    const params = new URLSearchParams();

    if (pageData && pageData !== 1) params.set("page", String(pageData));
    if (sortData && sortData !== DEFAULT_SORT) params.set("sortBy", sortData);

    if (filtersData.template_id) params.set("template_id", filtersData.template_id);
    if (filtersData.phone_number) params.set("phone_number", filtersData.phone_number);
    if (filtersData.uuid) params.set("uuid", filtersData.uuid);

    if (filtersData.language?.length) {
      params.set("language", filtersData.language.join(","));
    }

    if (filtersData.schema_name?.length) {
      params.set("schema_name", filtersData.schema_name.join(","));
    }

    if (filtersData.status?.length) {
      params.set("status", filtersData.status.join(","));
    }

    if (filtersData.created_after) {
      params.set("created_after", filtersData.created_after);
    }

    if (filtersData.created_before) {
      params.set("created_before", filtersData.created_before);
    }

    if (filtersData.rated_by) {
      params.set("rated_by", filtersData.rated_by);
    }

    if (filtersData.tags?.length) {
      params.set("tags", filtersData.tags.join(","));
    }

    const validEntityFilters = (filtersData.entity_filters || []).filter(
      (f) => f.key && f.operator && f.value !== "" && f.value !== null
    );

    if (validEntityFilters.length) {
      params.set("entity_filters", JSON.stringify(validEntityFilters));
    }

    return params;
  };

  const parseFiltersFromSearchParams = () => {
    let parsedEntityFilters = [];
    const rawEntityFilters = searchParams.get("entity_filters");

    if (rawEntityFilters) {
      try {
        parsedEntityFilters = JSON.parse(rawEntityFilters);
      } catch (e) {
        parsedEntityFilters = [];
      }
    }

    return {
      template_id: searchParams.get("template_id") || savedTemplate,
      phone_number: searchParams.get("phone_number") || "",
      uuid: searchParams.get("uuid") || "",
      language: searchParams.get("language")
        ? searchParams.get("language").split(",").filter(Boolean)
        : [],
      schema_name: searchParams.get("schema_name")
        ? searchParams.get("schema_name").split(",").filter(Boolean)
        : savedOrg
          ? [savedOrg]
          : [],
      status: searchParams.get("status")
        ? searchParams.get("status").split(",").filter(Boolean)
        : [],
      created_after: searchParams.get("created_after") || "",
      created_before: searchParams.get("created_before") || "",
      rated_by: searchParams.get("rated_by") || "",
      tags: searchParams.get("tags")
        ? searchParams.get("tags").split(",").filter(Boolean)
        : [],
      entity_filters: parsedEntityFilters,
    };
  };

  const syncUrl = (filtersData, pageData, sortData) => {
    const params = buildSearchParamsFromState(filtersData, pageData, sortData);
    setSearchParams(params);
  };

  /* ================= FETCH CALLS ================= */
  const fetchCalls = async (
    customFilters = filters,
    customPage = page,
    customSortBy = sortBy
  ) => {
    setLoading(true);

    try {
      const params = {
        page: customPage,
        ordering: customSortBy,

        ...(customFilters.template_id && { template_id: customFilters.template_id }),
        ...(customFilters.schema_name.length && {
          schema_name: customFilters.schema_name.join(","),
        }),
        ...(customFilters.entity_filters?.some(
          (f) => f.key && f.operator && f.value !== ""
        ) && {
          entity_filters: JSON.stringify(
            customFilters.entity_filters.filter(
              (f) => f.key && f.operator && f.value !== ""
            )
          ),
        }),
        ...(role === "lead" &&
          customFilters.phone_number && { phone_number: customFilters.phone_number }),
        ...(customFilters.uuid && { uuid: customFilters.uuid }),
        ...(customFilters.language.length && {
          language: customFilters.language.join(","),
        }),
        ...(customFilters.status.length && {
          status: customFilters.status.join(","),
        }),
        ...(customFilters.created_after && {
          created_after: customFilters.created_after,
        }),
        ...(customFilters.created_before && {
          created_before: customFilters.created_before,
        }),
      };

      if (role === "lead") {
        if (customFilters.rated_by) params.rated_by = customFilters.rated_by;
        if (customFilters.tags.length) params.tags = customFilters.tags.join(",");
      }

      const response = await axiosInstance.get("/calls/dashboard/", { params });

      const results = response.data.results ?? response.data;

      setCalls(results);
      setNextPageUrl(response.data.next ?? null);
      setPrevPageUrl(response.data.previous ?? null);

      const totalCount = response.data.count ?? results.length;
      setTotalCallCount(totalCount);
      setTotalPages(Math.ceil(totalCount / PAGE_SIZE));
      if (role === "consultant") {
        const initialRowData = {};
        results.forEach((call) => {
          const rated = (call.metrics || []).some(
            (m) => m.value !== null && m.value !== ""
          );

          initialRowData[call.uuid] = {
            metrics: call.metrics || [],
            isSubmitted: rated,
          };
        });
        setRowData(initialRowData);

        fetchAudioForCalls(results);
      }
    } catch (error) {
      console.error("Error fetching calls:", error);

      if (error.response?.status === 401) {
        localStorage.removeItem("role");
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ================= FETCH AUDIO FOR CONSULTANT DASHBOARD ================= */
  const fetchAudioForCalls = async (callsList) => {
    const newAudioMap = {};

    await Promise.all(
      callsList.map(async (call) => {
        try {
          const res = await axiosInstance.get(`/calls/audio/${call.uuid}/`);
          newAudioMap[call.uuid] = res.data.audio_url || "";
        } catch (err) {
          console.warn(`Audio fetch failed for ${call.uuid}`, err);
          newAudioMap[call.uuid] = "";
        }
      })
    );

    setAudioMap(newAudioMap);
  };

  /* ================= FETCH FILTER OPTIONS ================= */
  const fetchFilterOptions = async () => {
    try {
      const res = await axiosInstance.get("/calls/filter-options/");

      setFilterOptions({
        languages: res.data.languages || [],
        statuses: res.data.statuses || [],
        rated_by: res.data.rated_by || [],
        tags: res.data.tags || [],
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  /* ================= FETCH ENTITY KEYS ================= */
  const fetchEntityKeys = async (schemaName, templateId) => {
    if (!schemaName || !templateId) {
      setEntityKeys([]);
      return;
    }

    try {
      const res = await axiosInstance.get("/calls/selectable-entities/", {
        params: {
          schema_name: schemaName,
          template_id: templateId,
        },
      });

      setEntityKeys(res.data.entities || []);
    } catch (error) {
      console.error("Error fetching entity keys:", error);
      setEntityKeys([]);
    }
  };

  /* ================= FETCH ENTITY VALUES ================= */
  const fetchEntityValues = async (schemaName, templateId, entityKey, rowIndex) => {
    if (!schemaName || !templateId || !entityKey) {
      setEntityValueOptions((prev) => ({
        ...prev,
        [rowIndex]: [],
      }));
      return;
    }

    try {
      const res = await axiosInstance.get("/calls/selectable-entity-values/", {
        params: {
          schema_name: schemaName,
          template_id: templateId,
          entity_key: entityKey,
        },
      });

      setEntityValueOptions((prev) => ({
        ...prev,
        [rowIndex]: res.data.values || [],
      }));
    } catch (error) {
      console.error("Error fetching entity values:", error);
      setEntityValueOptions((prev) => ({
        ...prev,
        [rowIndex]: [],
      }));
    }
  };

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    const initializeDashboard = async () => {
      await fetchFilterOptions();

      const initialFilters = parseFiltersFromSearchParams();
      const initialPage =
        Number(searchParams.get("page")) > 0 ? Number(searchParams.get("page")) : 1;
      const initialSort = searchParams.get("sortBy") || DEFAULT_SORT;

      setFilters(initialFilters);
      setPage(initialPage);
      setSortBy(initialSort);

      if (initialFilters.schema_name?.[0] && initialFilters.template_id) {
        await fetchEntityKeys(initialFilters.schema_name[0], initialFilters.template_id);

        await Promise.all(
          (initialFilters.entity_filters || []).map(async (ef, index) => {
            if (ef.key) {
              await fetchEntityValues(
                initialFilters.schema_name[0],
                initialFilters.template_id,
                ef.key,
                index
              );
            }
          })
        );
      }

      fetchCalls(initialFilters, initialPage, initialSort);
    };

    initializeDashboard();
    // eslint-disable-next-line
  }, []);

  /* ================= HANDLERS ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addEntityFilterRow = () => {
    setFilters((prev) => ({
      ...prev,
      entity_filters: [
        ...(prev.entity_filters || []),
        { key: "", operator: "", value: "" },
      ],
    }));
  };

  const handleEntityOperatorChange = (index, operator) => {
    setFilters((prev) => {
      const updated = [...prev.entity_filters];
      updated[index].operator = operator;
      return { ...prev, entity_filters: updated };
    });
  };

  const handleEntityValueChange = (index, value) => {
    setFilters((prev) => {
      const updated = [...prev.entity_filters];
      updated[index].value = value;
      return { ...prev, entity_filters: updated };
    });
  };

  const removeEntityFilterRow = (index) => {
    setFilters((prev) => {
      const updated = [...(prev.entity_filters || [])];
      updated.splice(index, 1);

      return {
        ...prev,
        entity_filters: updated,
      };
    });

    setEntityValueOptions((prev) => {
      const updated = { ...prev };
      delete updated[index];

      const reindexed = {};
      Object.keys(updated).forEach((k) => {
        const oldIndex = Number(k);
        if (oldIndex < index) reindexed[oldIndex] = updated[oldIndex];
        else if (oldIndex > index) reindexed[oldIndex - 1] = updated[oldIndex];
      });

      return reindexed;
    });
  };

  const handleEntityKeyChange = async (index, key) => {
    const schemaName = filters.schema_name?.[0];
    const templateId = filters.template_id;

    setFilters((prev) => {
      const updated = [...(prev.entity_filters || [])];
      updated[index] = {
        key,
        operator: "",
        value: "",
      };
      return { ...prev, entity_filters: updated };
    });

    if (key) {
      await fetchEntityValues(schemaName, templateId, key, index);
    }
  };

  const handleSearch = () => {
    const invalidEntityRow = (filters.entity_filters || []).find(
      (f) => f.key && (!f.operator || f.value === "" || f.value === null)
    );

    if (invalidEntityRow) {
      toast.error("Please complete entity filter (operator + value)");
      return;
    }

    const newPage = 1;
    setPage(newPage);

    syncUrl(filters, newPage, sortBy);
    fetchCalls(filters, newPage, sortBy);
  };

  const handleReset = async () => {
    const resetFilters = {
      template_id: savedTemplate,
      phone_number: "",
      uuid: "",
      language: [],
      schema_name: savedOrg ? [savedOrg] : [],
      status: [],
      created_after: "",
      created_before: "",
      rated_by: "",
      tags: [],
      entity_filters: [],
    };

    setFilters(resetFilters);
    setEntityValueOptions({});
    setSortBy(DEFAULT_SORT);
    setPage(1);

    if (savedOrg && savedTemplate) {
      await fetchEntityKeys(savedOrg, savedTemplate);
    } else {
      setEntityKeys([]);
    }

    syncUrl(resetFilters, 1, DEFAULT_SORT);
    fetchCalls(resetFilters, 1, DEFAULT_SORT);
  };

  const handleSortChange = (value) => {
    const newPage = 1;
    setSortBy(value);
    setPage(newPage);

    syncUrl(filters, newPage, value);
    fetchCalls(filters, newPage, value);
  };

  const handlePreviousPage = () => {
    if (!prevPageUrl || page <= 1) return;

    const newPage = page - 1;
    setPage(newPage);

    syncUrl(filters, newPage, sortBy);
    fetchCalls(filters, newPage, sortBy);
  };

  const handleNextPage = () => {
    if (!nextPageUrl) return;

    const newPage = page + 1;
    setPage(newPage);

    syncUrl(filters, newPage, sortBy);
    fetchCalls(filters, newPage, sortBy);
  };

  /* ================= CONSULTANT INLINE RATING ================= */
  const areAllMetricsFilled = (metrics) => {
    return metrics.length > 0 && metrics.every((m) => Number(m.value) > 0);
  };

  const handleMetricChange = (uuid, metricName, value) => {
    setRowData((prev) => {
      const updatedMetrics = (prev[uuid]?.metrics || []).map((m) =>
        m.name === metricName ? { ...m, value } : m
      );

      const isSubmitted = prev[uuid]?.isSubmitted;
      const isLocked = calls.find((c) => c.uuid === uuid)?.is_locked;

      if (!isSubmitted && !isLocked && areAllMetricsFilled(updatedMetrics)) {
        if (!submittingMap[uuid]) {
          autoSubmitReview(uuid, updatedMetrics);
        }
      }

      return {
        ...prev,
        [uuid]: {
          ...prev[uuid],
          metrics: updatedMetrics,
        },
      };
    });
  };

  const autoSubmitReview = async (uuid, metrics) => {
    try {
      setSubmittingMap((prev) => ({ ...prev, [uuid]: true }));

      const ratings = {};
      metrics.forEach((m) => {
        ratings[m.name] = Number(m.value);
      });

      await axiosInstance.post("/calls/consultant-rating/", {
        call_uuid: uuid,
        ratings,
        comments: "",
      });

      setRowData((prev) => ({
        ...prev,
        [uuid]: {
          ...prev[uuid],
          isSubmitted: true,
        },
      }));

      fetchCalls(filters, page, sortBy);
    } catch (err) {
      console.error("Auto submit failed:", err);
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [uuid]: false }));
    }
  };

  /* ================= TABLE COLUMNS ================= */
  const leadColumns = [
    { key: "phone_number", label: "User Mobile No" },
    { key: "uuid", label: "Call UUID" },
    { key: "attempt_on_time_stamp", label: "Call Date & Time" },
    { key: "duration_display", label: "Duration" },
    { key: "status_display", label: "Review Status" },
    { key: "overall_rating", label: "Overall Rating" },
    { key: "rated_by_name", label: "Rated By" },
    { key: "tags_display", label: "Tags" },
  ];

  const consultantColumns = [
    { key: "uuid", label: "Call UUID" },
    { key: "attempt_on_time_stamp", label: "Call Date & Time" },
    { key: "duration_display", label: "Duration" },
    { key: "status_display", label: "Review Status" },
    { key: "overall_rating", label: "Overall Rating" },
    { key: "audio", label: "Audio" },
    { key: "inline_rating", label: "Rating" },
  ];

  const columns = role === "lead" ? leadColumns : consultantColumns;


  const headerLanguage =
    calls?.[0]?.languages_name ||
    calls?.[0]?.language_name ||
    "All Languages";

  const dashboardSubtitle = `${savedOrgName} - ${savedTemplateName} - ${headerLanguage}`;
  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <DashboardHeader
          title={role === "lead" ? "Lead Dashboard" : "Consultant Dashboard"}
          subtitle={dashboardSubtitle}
        />
        {/* Filters */}
        <div className="filter-card">
          <div className="filter-grid">
            {role === "lead" && (
              <div className="filter-item">
                <input
                  type="text"
                  name="phone_number"
                  placeholder="User Mobile No"
                  value={filters.phone_number}
                  onChange={handleChange}
                />
              </div>
            )}

            <div className="filter-item">
              <input
                type="text"
                name="uuid"
                placeholder="Call UUID"
                value={filters.uuid}
                onChange={handleChange}
              />
            </div>

            <div className="filter-item">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="-attempt_on_time_stamp">Latest Date First</option>
                <option value="attempt_on_time_stamp">Oldest Date First</option>
                <option value="duration">Call Duration Low to High</option>
                <option value="-duration">Call Duration High to Low</option>
              </select>
            </div>

            {/* <div className="filter-item">
              <select
                value={filters.language?.[0] || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    language: e.target.value ? [e.target.value] : [],
                  }))
                }
              >
                <option value="">Select Language</option>
                {filterOptions.languages.map((lang) => (
                  <option key={lang.language} value={lang.language}>
                    {lang.language_name}
                  </option>
                ))}
              </select>
            </div> */}

            <div className="filter-item">
              <select
                value={filters.status?.[0] || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value ? [e.target.value] : [],
                  }))
                }
              >
                <option value="">Select Call Review Status</option>
                {filterOptions.statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {role === "lead" && (
              <>
                <div className="filter-item">
                  <select
                    value={filters.rated_by}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        rated_by: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select Rated By</option>
                    {filterOptions.rated_by.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-item">
                  <select
                    value={filters.tags?.[0] || ""}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        tags: e.target.value ? [e.target.value] : [],
                      }))
                    }
                  >
                    <option value="">Select Tag</option>
                    {filterOptions.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="filter-item filter-item-span-2">
              <div className="date-range">
                <input
                  type="date"
                  name="created_after"
                  value={filters.created_after}
                  onChange={handleChange}
                />
                <span className="to-text">to</span>
                <input
                  type="date"
                  name="created_before"
                  value={filters.created_before}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="entity-inline-section">
            <div className="entity-inline-header">
              <button
                type="button"
                className="add-entity-btn"
                onClick={addEntityFilterRow}
              >
                + Add Entity Filter
              </button>

              <div className="call-count-badge">
                Total Calls: <span>{totalCallCount}</span>
              </div>
            </div>

            {(filters.entity_filters || []).length > 0 && (
              <div className="entity-inline-list">
                {(filters.entity_filters || []).map((entityFilter, index) => (
                  <div key={index} className="entity-inline-row">
                    <select
                      className="entity-key-select"
                      value={entityFilter.key}
                      onChange={(e) => handleEntityKeyChange(index, e.target.value)}
                      disabled={!filters.schema_name?.[0] || !filters.template_id}
                    >
                      <option value="">Select Entity Key</option>
                      {entityKeys.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.key}
                        </option>
                      ))}
                    </select>

                    <select
                      className="entity-operator-select"
                      value={entityFilter.operator}
                      onChange={(e) =>
                        handleEntityOperatorChange(index, e.target.value)
                      }
                      disabled={!entityFilter.key}
                    >
                      <option value="">Select Operator</option>
                      {(entityKeys.find((k) => k.key === entityFilter.key)?.operators ||
                        []).map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                    </select>

                    {(() => {
                      const selectedEntity = entityKeys.find(
                        (k) => k.key === entityFilter.key
                      );
                      const dataType = selectedEntity?.data_type || "string";

                      if (dataType === "date") {
                        return (
                          <input
                            type="date"
                            className="entity-value-input"
                            value={entityFilter.value || ""}
                            onChange={(e) =>
                              handleEntityValueChange(index, e.target.value)
                            }
                            disabled={!entityFilter.operator}
                          />
                        );
                      }

                      if (dataType === "time") {
                        return (
                          <input
                            type="time"
                            className="entity-value-input"
                            value={entityFilter.value || ""}
                            onChange={(e) =>
                              handleEntityValueChange(index, e.target.value)
                            }
                            disabled={!entityFilter.operator}
                          />
                        );
                      }

                      if (dataType === "datetime") {
                        return (
                          <input
                            type="datetime-local"
                            className="entity-value-input"
                            value={entityFilter.value || ""}
                            onChange={(e) =>
                              handleEntityValueChange(index, e.target.value)
                            }
                            disabled={!entityFilter.operator}
                          />
                        );
                      }

                      if (dataType === "boolean") {
                        return (
                          <select
                            className="entity-value-input"
                            value={entityFilter.value ?? ""}
                            onChange={(e) =>
                              handleEntityValueChange(index, e.target.value)
                            }
                            disabled={!entityFilter.operator}
                          >
                            <option value="">Select Value</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        );
                      }

                      if (dataType === "number") {
                        return (
                          <input
                            type="number"
                            className="entity-value-input"
                            placeholder="Enter number"
                            value={entityFilter.value || ""}
                            onChange={(e) =>
                              handleEntityValueChange(index, e.target.value)
                            }
                            disabled={!entityFilter.operator}
                          />
                        );
                      }

                      return (
                        <input
                          type="text"
                          className="entity-value-input"
                          placeholder="Enter value"
                          value={entityFilter.value || ""}
                          onChange={(e) =>
                            handleEntityValueChange(index, e.target.value)
                          }
                          disabled={!entityFilter.operator}
                        />
                      );
                    })()}

                    <button
                      type="button"
                      className="remove-entity-btn"
                      onClick={() => removeEntityFilterRow(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="filter-actions">
            <button className="search-btn" onClick={handleSearch}>
              Search
            </button>
            <button className="reset-btn" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="table-card">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="no-data">
                      No Data Found
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr key={call.uuid}>
                      {columns.map((col) => {
                        if (col.key === "attempt_on_time_stamp") {
                          return (
                            <td key={col.key}>
                              {call[col.key]
                                ? new Date(call[col.key]).toLocaleString()
                                : "-"}
                            </td>
                          );
                        }

                        if (col.key === "audio") {
                          return (
                            <td key={col.key} style={{ minWidth: "90px" }}>
                              {audioMap[call.uuid] ? (
                                <MiniAudioPlayer src={audioMap[call.uuid]} />
                              ) : (
                                <span>Audio not available</span>
                              )}
                            </td>
                          );
                        }

                        if (col.key === "inline_rating") {
                          const row = rowData[call.uuid] || {};
                          const rowMetrics = row.metrics || [];
                          const isSubmitted = row.isSubmitted;
                          const isLocked = !!call.is_locked;
                          const disabled = isLocked || isSubmitted;

                          return (
                            <td key={col.key} style={{ minWidth: "180px" }}>
                              {rowMetrics.length === 0 ? (
                                <span>No metrics</span>
                              ) : (
                                <>
                                  {rowMetrics.map((m) => {
                                    const useStars = Number(m.max) <= 5;

                                    return (
                                      <div
                                        key={m.name}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          marginBottom: "6px",
                                          gap: "8px",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "12px",
                                            color: "#555",
                                            textTransform: "capitalize",
                                            minWidth: "70px",
                                          }}
                                        >
                                          {m.name}
                                        </span>

                                        {useStars ? (
                                          <StarRating
                                            value={m.value ?? 0}
                                            disabled={disabled}
                                            size={14}
                                            onChange={(val) =>
                                              handleMetricChange(call.uuid, m.name, val)
                                            }
                                          />
                                        ) : (
                                          <input
                                            type="number"
                                            min="0"
                                            max={m.max}
                                            value={m.value ?? ""}
                                            disabled={disabled}
                                            onChange={(e) =>
                                              handleMetricChange(
                                                call.uuid,
                                                m.name,
                                                e.target.value
                                              )
                                            }
                                            style={{ width: "70px" }}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </td>
                          );
                        }

                        return <td key={col.key}>{call[col.key] ?? "-"}</td>;
                      })}

                      <td>
                        <button
                          className="view-btn"
                          onClick={() => {
                            const currentRole = localStorage.getItem("role");
                            const currentDashboardPath = `${location.pathname}${location.search}`;

                            if (currentRole === "consultant") {
                              navigate(`/consultant/review/${call.uuid}`, {
                                state: { from: currentDashboardPath },
                              });
                            } else if (currentRole === "lead") {
                              navigate(`/lead/review/${call.uuid}`, {
                                state: { from: currentDashboardPath },
                              });
                            }
                          }}
                        >
                          View Call
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button disabled={!prevPageUrl || page <= 1} onClick={handlePreviousPage}>
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button disabled={!nextPageUrl} onClick={handleNextPage}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;