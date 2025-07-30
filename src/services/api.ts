import axios from 'axios';

const api = axios.create({
  baseURL: 'https://localhost:5000/api/Matches', // substitua pela URL da sua API
});

export default api;
