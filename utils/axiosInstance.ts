import axios from "axios";
import { clearPendingChainRecord, savePendingChainRecord } from "@/lib/chainRecovery";

// Points at the backend's context path (server.servlet.context-path), so the
// API version is set once here and never repeated in utils/apiPaths.ts.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    const config = response.config;
    if (typeof window !== "undefined" && config.method?.toLowerCase() === "post" && config.url) {
      try { clearPendingChainRecord(config.url, JSON.parse(config.data || "{}")); } catch { /* no JSON payload */ }
    }
    return response;
  },
  (error) => {
    const config = error.config;
    if (typeof window !== "undefined" && (!error.response || error.response.status >= 500)
      && config?.method?.toLowerCase() === "post" && config.url) {
      try { savePendingChainRecord(config.url, JSON.parse(config.data || "{}")); } catch { /* no JSON payload */ }
    }
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
