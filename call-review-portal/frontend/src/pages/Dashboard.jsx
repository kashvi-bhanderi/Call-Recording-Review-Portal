import React, { useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";

const Dashboard = ({ role }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState({
    template_id: "",
    phone_number: "",
    uuid: "",
    language: [],
    schema_name: [],
    status: [],
    rated_by: "",
    tags: []
  });

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        template_id: filters.template_id,
        phone_number: filters.phone_number,
        uuid: filters.uuid,
        language: filters.language.join(","),
        schema_name: filters.schema_name.join(","),
        status: filters.status.join(","),
      };

      // Lead-only filters
      if (role === "lead") {
        params.rated_by = filters.rated_by;
        params.tags = filters.tags.join(",");
      }

      const response = await axiosInstance.get(
        "/calls/dashboard/",
        { params }
      );

      const results = response.data.results || response.data;
      setCalls(results);
      setTotalPages(
        Math.ceil((response.data.count || results.length) / 10)
      );

    } catch (error) {
      console.error("Error fetching calls:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalls();
    // eslint-disable-next-line
  }, [page]);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = () => {
    setPage(1);
    fetchCalls();
  };

  const handleReset = () => {
    setFilters({
      template_id: "",
      phone_number: "",
      uuid: "",
      language: [],
      schema_name: [],
      status: [],
      rated_by: "",
      tags: []
    });
    setPage(1);
    fetchCalls();
  };

  // Base columns (visible to all)
  const baseColumns = [
    { key: "template_id", label: "Template ID" },
    { key: "language_name", label: "Language" },
    { key: "schema_name", label: "Schema Name" },
    { key: "phone_number", label: "Provider Mobile" },
    { key: "uuid", label: "Call UUID" },
    { key: "attempt_on_time_stamp", label: "Call Date" },
    { key: "status_display", label: "Review Status" },
    { key: "overall_rating", label: "Overall Rating" },
  ];

  // Lead-only columns
  const leadColumns = [
    { key: "rated_by_name", label: "Rated By" },
    { key: "tags_display", label: "Tags" },
  ];

  const columns =
    role === "lead"
      ? [...baseColumns, ...leadColumns]
      : baseColumns;

  return (
    <div style={{ padding: "20px" }}>
      <h2>{role === "lead" ? "Lead Dashboard" : "Consultant Dashboard"}</h2>

      {/* Filters */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          name="template_id"
          placeholder="Template ID"
          value={filters.template_id}
          onChange={handleChange}
        />
        <input
          type="text"
          name="phone_number"
          placeholder="Provider Mobile"
          value={filters.phone_number}
          onChange={handleChange}
        />
        <input
          type="text"
          name="uuid"
          placeholder="Call UUID"
          value={filters.uuid}
          onChange={handleChange}
        />

        {role === "lead" && (
          <>
            <input
              type="text"
              name="rated_by"
              placeholder="Rated By"
              value={filters.rated_by}
              onChange={handleChange}
            />
            <input
              type="text"
              name="tags"
              placeholder="Tags"
              value={filters.tags}
              onChange={handleChange}
            />
          </>
        )}

        <button onClick={handleSearch}>Search</button>
        <button onClick={handleReset}>Reset</button>
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table border="1" width="100%" cellPadding="8">
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
                <td colSpan={columns.length + 1} style={{ textAlign: "center" }}>
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
                      onClick={() =>
                        (window.location.href = `/call/${call.id}`)
                      }
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

      {/* Pagination */}
      <div style={{ marginTop: "20px" }}>
        <button
          disabled={page === 1}
          onClick={() => setPage((prev) => prev - 1)}
        >
          Previous
        </button>
        <span style={{ margin: "0 10px" }}>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Dashboard;