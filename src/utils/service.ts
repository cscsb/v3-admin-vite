import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios"
import { useUserStoreHook } from "@/store/modules/user"
import { ElMessage } from "element-plus"
import { get, merge } from "lodash-es"
import { getToken } from "./cache/cookies"
import { defineMessageMap } from "@/utils/messages" // 假设有一个工具来管理消息映射

// 定义错误处理函数
function handleError(error: any) {
  // 状态码映射表
  const statusMessageMap = defineMessageMap()
  const status = get(error, "response.status")
  let errorMessage = "网络错误"

  if (status && statusMessageMap[status]) {
    errorMessage = statusMessageMap[status]
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message
  }

  ElMessage.error(errorMessage)
  return Promise.reject(error)
}

/** 退出登录并强制刷新页面（会重定向到登录页） */
function logout() {
  useUserStoreHook().logout()
  // 可以考虑使用更友好的方式通知用户，而不是直接刷新页面
  location.reload()
}

/** 创建请求实例 */
function createService() {
  // 创建一个 axios 实例命名为 service
  const service = axios.create()
  // 请求拦截
  service.interceptors.request.use(
    (config) => config,
    (error) => handleError(error)
  )
  // 响应拦截（可根据具体业务作出相应的调整）
  service.interceptors.response.use(
    (response) => {
      // 对响应数据进行校验
      if (!response.data || typeof response.data !== "object") {
        return handleError({
          response: {
            status: 500,
            data: { message: "服务器返回的数据格式错误" },
          },
        })
      }
      const apiData = response.data
      const responseType = response.request?.responseType
      if (responseType === "blob" || responseType === "arraybuffer") return apiData
      const code = apiData.code
      if (code === undefined) {
        return handleError({
          response: {
            status: 500,
            data: { message: "非本系统的接口" },
          },
        })
      }
      switch (code) {
        case 0:
          return apiData
        case 401:
          logout()
          return Promise.reject(new Error("Token 过期"))
        default:
          return handleError({
            response: {
              status: code,
              data: { message: apiData.message || "Error" },
            },
          })
      }
    },
    (error) => handleError(error)
  )
  return service
}

/** 创建请求方法 */
function createRequest(service: AxiosInstance) {
  return function <T>(config: AxiosRequestConfig): Promise<T> {
    const token = getToken()
    const defaultConfig = {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        "Content-Type": "application/json",
      },
      timeout: 5000,
      baseURL: import.meta.env.VITE_BASE_API,
      data: {},
    }
    const mergeConfig = merge(defaultConfig, config)
    return service(mergeConfig)
  }
}

/** 用于网络请求的实例 */
const service = createService()
/** 用于网络请求的方法 */
export const request = createRequest(service)
