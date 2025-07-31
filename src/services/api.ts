import axios from 'axios';

const api = axios.create({
    baseURL: 'eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches', // substitua pela URL da sua API
});

export default api;
