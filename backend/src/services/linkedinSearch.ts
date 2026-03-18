import axios from 'axios';
import { calculateScore, LeadData } from './leadScoring.js';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export const searchLinkedinCompanies = async (query: string, city: string) => {
    if (!TAVILY_API_KEY || TAVILY_API_KEY.includes('...')) {
        console.warn('Tavily API Key not configured. Returning mock LinkedIn data.');
        return getMockLinkedinLeads(query, city);
    }

    try {
        // Busca refinada para empresas no LinkedIn
        const searchQuery = `site:linkedin.com/company "${query}" "${city}"`;
        
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: searchQuery,
            search_depth: "advanced",
            max_results: 10,
            include_domains: ["linkedin.com"]
        });

        const results = response.data.results || [];

        const leads = results.map((result: any) => {
            // Tenta extrair o nome da empresa do título do LinkedIn
            let name = result.title.split(':')[0].split('|')[0].trim();
            
            const leadInfo: LeadData = {
                name: name,
                address: city,
                website: result.url, 
                segment: query,
                image_url: null
            };

            return {
                ...leadInfo,
                city: city,
                state: "N/A",
                score: calculateScore(leadInfo), 
                status: 'new',
                linkedin_url: result.url,
                origin: 'linkedin',
                has_own_website: false 
            };
        });

        return leads;
    } catch (error) {
        console.error('Error searching LinkedIn leads via Tavily:', error);
        throw error;
    }
};

const getMockLinkedinLeads = (query: string, city: string) => {
    return [
        {
            name: `${query} Corp LinkedIn`,
            segment: query,
            city: city,
            state: "N/A",
            website: "https://www.linkedin.com/company/example-corp",
            score: 70,
            status: "new",
            origin: "linkedin",
            linkedin_url: "https://www.linkedin.com/company/example-corp"
        },
        {
            name: `${query} Services & Co`,
            segment: query,
            city: city,
            state: "N/A",
            website: "https://www.linkedin.com/company/example-services",
            score: 65,
            status: "new",
            origin: "linkedin",
            linkedin_url: "https://www.linkedin.com/company/example-services"
        }
    ];
};
