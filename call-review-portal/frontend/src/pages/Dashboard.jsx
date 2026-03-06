import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./Dashboard.css";

const Dashboard = ({ role }) => {
  const navigate = useNavigate();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  
  // Pagination URLs from DRF
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
  const fetchCalls = async (customFilters = filters, customPage = page) => {
    setLoading(true);

    try {
      const params = {
        page: customPage,
        template_id: customFilters.template_id,
        phone_number: customFilters.phone_number,
        uuid: customFilters.uuid,
        language: customFilters.language.join(","),
        schema_name: customFilters.schema_name.join(","),
        status: customFilters.status.join(","),
        created_after: customFilters.created_after,
        created_before: customFilters.created_before,
      };

      if (role === "lead") {
        params.rated_by = customFilters.rated_by;
        params.tags = customFilters.tags.join(",");
      }

      const response = await axiosInstance.get("/calls/dashboard/", { params });
      const results = response.data.results ?? response.data;
      setCalls(results);

      // Set DRF pagination URLs
      setNextPageUrl(response.data.next);
      setPrevPageUrl(response.data.previous);

      // Total pages for display
      const totalCount = response.data.count ?? results.length;
      setTotalPages(Math.ceil(totalCount / PAGE_SIZE));
    } catch (error) {
      console.error("Error fetching calls:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("role");
        navigate("/");
      }
    }

    setLoading(false);
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
    fetchCalls();
    // eslint-disable-next-line
  }, [page]);

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    try {
      await axiosInstance.post("/auth/logout/");
      localStorage.removeItem("role");
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  /* ================= HANDLERS ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleSearch = () => {
    setPage(1);
    fetchCalls(filters, 1);
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
    setPage(1);
    fetchCalls(clearedFilters, 1);
  };

  /* ================= TABLE COLUMNS ================= */
  const baseColumns = [
    { key: "template_id", label: "Template ID" },
    { key: "language_name", label: "Language" },
    { key: "schema_name", label: "Schema Name" },
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
        <div className="dashboard-header">
          <h2>{role === "lead" ? "Lead Dashboard" : "Consultant Dashboard"}</h2>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* Filters */}
        <div className="filter-card">
          {/* Row 1 */}
          <div className="filter-row">
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
          </div>

          {/* Row 2 */}
          <div className="filter-row">
            <div className="filter-item">
              <select
                value={filters.language?.[0] || ""}
                onChange={(e) =>
                  setFilters({ ...filters, language: [e.target.value] })
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
                  setFilters({ ...filters, schema_name: [e.target.value] })
                }
              >
                <option value="">Select Schema</option>
                {filterOptions.schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <select
                value={filters.status?.[0] || ""}
                onChange={(e) =>
                  setFilters({ ...filters, status: [e.target.value] })
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

            <div className="filter-item date-range">
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

            {role === "lead" && (
              <>
                <div className="filter-item">
                  <select
                    value={filters.rated_by}
                    onChange={(e) =>
                      setFilters({ ...filters, rated_by: e.target.value })
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
                      setFilters({ ...filters, tags: [e.target.value] })
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

          {/* Buttons */}
          <div className="filter-actions">
            <button onClick={handleSearch}>Search</button>
            <button onClick={handleReset}>Reset</button>
          </div>
        </div>

        {/* Table */}
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
                    <tr key={call.id}>
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.key === "attempt_on_time_stamp"
                            ? new Date(call[col.key]).toLocaleString()
                            : call[col.key] ?? "-"}
                        </td>
                      ))}

                      <td>
                        <button
                          className="view-btn"
                          onClick={() => navigate(`/call/${call.id}`)}
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

          <span>Page {page} of {totalPages}</span>

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