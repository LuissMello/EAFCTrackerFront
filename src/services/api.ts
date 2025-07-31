import axios from 'axios';

const api = axios.create({
    baseURL: 'https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net', // substitua pela URL da sua API
});

export default api;
