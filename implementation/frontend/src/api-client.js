import axios from 'axios';

// Vite 프록시(/api → localhost:5000)를 타기 위해 baseURL은 빈 문자열.
// 모든 API 호출은 '/api/...' 형태로 해야 프록시가 가로채서 백엔드로 전달한다.
export const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
