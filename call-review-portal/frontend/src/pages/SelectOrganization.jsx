import React, { useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./Login.css";

const SelectOrganization = ({ role }) => {
  const [organizations, setOrganizations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const res = await axiosInstance.get("/calls/selectable-organizations/");
      setOrganizations(res.data.organizations || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setLoadingOrgs(false);
    }
  };

  const fetchTemplates = async (schemaName) => {
    if (!schemaName) {
      setTemplates([]);
      return;
    }

    setLoadingTemplates(true);
    try {
      const res = await axiosInstance.get("/calls/selectable-templates/", {
        params: { schema_name: schemaName },
      });
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleOrgChange = async (e) => {
    const org = e.target.value;
    setSelectedOrg(org);
    setSelectedTemplate("");
    setTemplates([]);
    localStorage.removeItem("selectedTemplate");

    if (org) {
      await fetchTemplates(org);
    }
  };

  const handleContinue = () => {
    if (!selectedOrg) {
      toast.error("Please select organization");
      return;
    }

    if (!selectedTemplate) {
      toast.error("Please select template");
      return;
    }

    localStorage.setItem("selectedOrg", selectedOrg);
    localStorage.setItem("selectedTemplate", selectedTemplate);

    if (role === "consultant") {
      navigate("/consultant");
    } else {
      navigate("/lead");
    }
  };

  const heading = !selectedOrg ? "Select Organization" : "Select Template";

  return (
    <div className="login-container">
      <div className="login-form">
        <h2 className="select-page-title">{heading}</h2>

        {loadingOrgs ? (
          <p>Loading organizations...</p>
        ) : (
          <>
            <label className="field-label">Organization</label>
            <select
              value={selectedOrg}
              onChange={handleOrgChange}
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

            {selectedOrg && (
              <>
                <label className="field-label">Template</label>

                {loadingTemplates ? (
                  <p>Loading templates...</p>
                ) : (
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      marginBottom: "16px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                    }}
                  >
                    <option value="">Select Template</option>
                    {templates.map((template) => (
                      <option
                        key={template.template_id}
                        value={template.template_id}
                      >
                        {template.template_name
                          ? `${template.template_name} (${template.template_id})`
                          : template.template_id}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <button
              onClick={handleContinue}
              disabled={!selectedOrg || !selectedTemplate}
              style={{
                opacity: !selectedOrg || !selectedTemplate ? 0.7 : 1,
                cursor:
                  !selectedOrg || !selectedTemplate ? "not-allowed" : "pointer",
              }}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectOrganization;