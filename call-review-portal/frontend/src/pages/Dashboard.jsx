import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./Dashboard.css";
import DashboardHeader from "../components/DashboardHeader";
const Dashboard = ({ role }) => {
  const navigate = useNavigate();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("-attempt_on_time_stamp");

  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [prevPageUrl, setPrevPageUrl] = useState(null);

  const PAGE_SIZE = 10;

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

  /* ================= FETCH CALLS ================= */
  const fetchCalls = async (customFilters = filters, customPage = page, customSortBy = sortBy) => {
    setLoading(true);

    try {
      const params = {
        page: customPage,
        ordering: customSortBy,
        ...(customFilters.template_id && { template_id: customFilters.template_id }),
        ...(customFilters.phone_number && { phone_number: customFilters.phone_number }),
        ...(customFilters.uuid && { uuid: customFilters.uuid }),
        ...(customFilters.language.length && { language: customFilters.language.join(",") }),
        ...(customFilters.schema_name.length && { schema_name: customFilters.schema_name.join(",") }),
        ...(customFilters.status.length && { status: customFilters.status.join(",") }),
        ...(customFilters.created_after && { created_after: customFilters.created_after }),
        ...(customFilters.created_before && { created_before: customFilters.created_before }),
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

  /* ================= LOGOUT ================= */

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

  /* ================= TABLE COLUMNS ================= */
  const baseColumns = [
    { key: "template_id", label: "Template ID" },
    { key: "language_name", label: "Language" },
    { key: "organization_name", label: "Organization" },
    { key: "phone_number", label: "Provider Mobile" },
    { key: "uuid", label: "Call UUID" },
    { key: "attempt_on_time_stamp", label: "Call Date & Time" },
    { key: "duration_display", label: "Duration" },
    { key: "status_display", label: "Review Status" },
    { key: "overall_rating", label: "Overall Rating" },
  ];

  const leadColumns = [
    { key: "rated_by_name", label: "Rated By" },
    { key: "tags_display", label: "Tags" },
  ];

  const columns = role === "lead" ? [...baseColumns, ...leadColumns] : baseColumns;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Header */}
        <DashboardHeader title={role === "lead" ? "Lead Dashboard" : "Consultant Dashboard"} />
        {/* Filters */}
        <div className="filter-card">
          <div className="filter-grid">
            {/* Row 1 */}
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
                placeholder="Provider Mobile"
                value={filters.phone_number}
                onChange={handleChange}
              />
            </div>

            <div className="filter-item">
              <input
                type="text"
                name="uuid"
                placeholder="Call UUID"
                value={filters.uuid}
                onChange={handleChange}
              />
            </div>

            {/* Row 2 */}
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

            {/* Date Range - takes 2 columns */}
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

            {/* Lead only filters */}
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
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.key === "attempt_on_time_stamp"
                            ? call[col.key]
                              ? new Date(call[col.key]).toLocaleString()
                              : "-"
                            : call[col.key] ?? "-"}
                        </td>
                      ))}

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