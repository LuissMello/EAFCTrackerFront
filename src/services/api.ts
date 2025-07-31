import axios from 'axios';

const api = axios.create({
    baseURL: 'https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches',
});

export default api;
