"use strict";

import axios from "axios";
import { Notification } from 'element-ui';

// Full config:  https://github.com/axios/axios#request-config
// axios.defaults.baseURL = process.env.baseURL || process.env.apiUrl || '';
// axios.defaults.headers.common['Authorization'] = AUTH_TOKEN;
// axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

let config = {
    // baseURL: process.env.baseURL || process.env.apiUrl || ""
    baseURL: "/api"
    // timeout: 60 * 1000, // Timeout
    // withCredentials: true, // Check cross-site Access-Control
    // headers: { "X-Zplat-Subsystem": "zpan" }
};

const _axios = axios.create(config);

// Add a response interceptor
_axios.interceptors.response.use(
    function (response) {
        return response.data;
    },
    function (error) {
        if (error.response && error.response.status == 401) {
            window.location = "/u/signin"
            return Promise.reject("invalid login status");
        } else if (error.response && error.response.status == 520) {
            return Promise.reject(error)
        }

        let msg = error.message
        if (error.response && error.response.data.msg) {
            msg = error.response.data.msg
        }

        // alert the Notification only for the operation
        if (error.response.config.method != 'get') {
            Notification.error(msg)
        }

        return Promise.reject(error);
    }
);

export const rawAxios = axios;
export default _axios
