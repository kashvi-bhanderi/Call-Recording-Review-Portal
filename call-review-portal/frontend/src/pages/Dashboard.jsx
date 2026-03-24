
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./Dashboard.css";
import DashboardHeader from "../components/DashboardHeader";
import MiniAudioPlayer from "../components/MiniAudioPlayer";
import StarRating from "../components/starrating";
import toast from "react-hot-toast";

const Dashboard = ({ role }) => {
  const navigate = useNavigate();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("-attempt_on_time_stamp");

  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [prevPageUrl, setPrevPageUrl] = useState(null);

  const PAGE_SIZE = 8;

  const [filterOptions, setFilterOptions] = useState({
    languages: [],
    schemas: [],
    statuses: [],
    rated_by: [],
    tags: [],
  });

  const [filters, setFilters] = useState({
    template_id: "",
    phone_number: "",
    uuid: "",
    language: [],
    schema_name: [],
    status: [],
    created_after: "",
    created_before: "",
    rated_by: "",
    tags: [],
  });

  const [audioMap, setAudioMap] = useState({});
  const [rowData, setRowData] = useState({});
  const [submittingMap, setSubmittingMap] = useState({});

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
        ...(role === "lead" &&
          customFilters.template_id && { template_id: customFilters.template_id }),
        ...(role === "lead" &&
          customFilters.phone_number && { phone_number: customFilters.phone_number }),
        ...(customFilters.uuid && { uuid: customFilters.uuid }),
        ...(customFilters.language.length && {
          language: customFilters.language.join(","),
        }),
        ...(customFilters.schema_name.length && {
          schema_name: customFilters.schema_name.join(","),
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
      setNextPageUrl(response.data.next);
      setPrevPageUrl(response.data.previous);

      const totalCount = response.data.count ?? results.length;
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
        schemas: res.data.schemas || [],
        statuses: res.data.statuses || [],
        rated_by: res.data.rated_by || [],
        tags: res.data.tags || [],
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchCalls(filters, page, sortBy);
    // eslint-disable-next-line
  }, [page, sortBy]);

  /* ================= HANDLERS ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    setPage(1);
    fetchCalls(filters, 1, sortBy);
  };

  const handleReset = () => {
    const clearedFilters = {
      template_id: "",
      phone_number: "",
      uuid: "",
      language: [],
      schema_name: [],
      status: [],
      created_after: "",
      created_before: "",
      rated_by: "",
      tags: [],
    };

    setFilters(clearedFilters);
    setSortBy("-attempt_on_time_stamp");
    setPage(1);
    fetchCalls(clearedFilters, 1, "-attempt_on_time_stamp");
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

    // ✅ AUTO SAVE CONDITION
    if (!isSubmitted && !isLocked && areAllMetricsFilled(updatedMetrics)) {
      autoSubmitReview(uuid, updatedMetrics);
      if (submittingMap[uuid]) return;
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

  const submitInlineReview = async (uuid) => {
    try {
      setSubmittingMap((prev) => ({ ...prev, [uuid]: true }));

      const currentRow = rowData[uuid];
      const ratings = {};

      (currentRow?.metrics || []).forEach((m) => {
        if (m.value !== null && m.value !== "") {
          ratings[m.name] = Number(m.value);
        }
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

      toast.success("Review submitted successfully");
      fetchCalls(filters, page, sortBy);
    } catch (err) {
      console.error("Inline submit failed:", err);
      const msg = err.response?.data?.error || "Failed to submit review";
      toast.error(msg);
      fetchCalls(filters, page, sortBy);
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [uuid]: false }));
    }
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

    // optional: refresh for lock sync
    fetchCalls(filters, page, sortBy);

  } catch (err) {
    console.error("Auto submit failed:", err);
  } finally {
    setSubmittingMap((prev) => ({ ...prev, [uuid]: false }));
  }
};
  /* ================= TABLE COLUMNS ================= */
  const leadColumns = [
    { key: "template_id", label: "Template ID" },
    { key: "language_name", label: "Language" },
    { key: "organization_name", label: "Organization" },
    { key: "phone_number", label: "Mobile No" },
    { key: "uuid", label: "Call UUID" },
    { key: "attempt_on_time_stamp", label: "Call Date & Time" },
    { key: "duration_display", label: "Duration" },
    { key: "status_display", label: "Review Status" },
    { key: "overall_rating", label: "Overall Rating" },
    { key: "rated_by_name", label: "Rated By" },
    { key: "tags_display", label: "Tags" },
  ];

  const consultantColumns = [
    { key: "language_name", label: "Language" },
    { key: "organization_name", label: "Organization" },
    { key: "uuid", label: "Call UUID" },
    { key: "attempt_on_time_stamp", label: "Call Date & Time" },
    { key: "duration_display", label: "Duration" },
    { key: "status_display", label: "Review Status" },
    { key: "audio", label: "Audio" },
    { key: "inline_rating", label: "Rating" },
  ];

  const columns = role === "lead" ? leadColumns : consultantColumns;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <DashboardHeader
          title={role === "lead" ? "Lead Dashboard" : "Consultant Dashboard"}
        />

        {/* Filters */}
        <div className="filter-card">
          <div className="filter-grid">
            {role === "lead" && (
              <>
                <div className="filter-item">
                  <input
                    type="text"
                    name="template_id"
                    placeholder="Template ID"
                    value={filters.template_id}
                    onChange={handleChange}
                  />
                </div>

                <div className="filter-item">
                  <input
                    type="text"
                    name="phone_number"
                    placeholder="Mobile No"
                    value={filters.phone_number}
                    onChange={handleChange}
                  />
                </div>
              </>
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
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="-attempt_on_time_stamp">Latest First</option>
                <option value="attempt_on_time_stamp">Oldest First</option>
                <option value="duration">Duration Low to High</option>
                <option value="-duration">Duration High to Low</option>
              </select>
            </div>

            <div className="filter-item">
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
            </div>

            <div className="filter-item">
              <select
                value={filters.schema_name?.[0] || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    schema_name: e.target.value ? [e.target.value] : [],
                  }))
                }
              >
                <option value="">Select Organization</option>
                {filterOptions.schemas.map((s) => (
                  <option key={s.schema_name} value={s.schema_name}>
                    {s.org_name}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="">Select Status</option>
                {filterOptions.statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

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

                        /* ================= REPLACE ONLY THIS BLOCK ================= */

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
                                          marginBottom: "2px",
                                        }}
                                      >
                                        {/* label */}
                                        <span
                                          style={{
                                            fontSize: "12px",
                                            color: "#555",
                                            textTransform: "lowercase",
                                          }}
                                        >
                                          {m.name}
                                        </span>

                                        {/* stars */}
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
                                            value={m.value ?? ""}
                                            disabled={disabled}
                                            onChange={(e) =>
                                              handleMetricChange(call.uuid, m.name, e.target.value)
                                            }
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

                            if (currentRole === "consultant") {
                              navigate(`/consultant/review/${call.uuid}`);
                            } else if (currentRole === "lead") {
                              navigate(`/lead/review/${call.uuid}`);
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
          <button
            disabled={!prevPageUrl}
            onClick={() => setPage((prev) => prev - 1)}
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            disabled={!nextPageUrl}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
