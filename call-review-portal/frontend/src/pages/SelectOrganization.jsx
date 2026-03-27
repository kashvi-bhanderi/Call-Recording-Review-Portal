import React, { useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./Login.css";

const SelectOrganization = ({ role }) => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/calls/selectable-organizations/");
      setOrganizations(res.data.organizations || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedOrg) {
      toast.error("Please select organization");
      return;
    }

    localStorage.setItem("selectedOrg", selectedOrg);
    localStorage.removeItem("selectedTemplate");

    if (role === "consultant") {
      navigate("/consultant/select-template");
    } else {
      navigate("/lead/select-template");
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Select Organization</h2>

        {loading ? (
          <p>Loading organizations...</p>
        ) : (
          <>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "16px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            >
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.schema_name} value={org.schema_name}>
                  {org.org_name}
                </option>
              ))}
            </select>

            <button onClick={handleContinue}>Continue</button>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectOrganization;