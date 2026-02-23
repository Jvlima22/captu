import axios from 'axios';
import { calculateScore, LeadData } from './leadScoring';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface SearchFilters {
    radius?: number;
    minRating?: number;
    minReviews?: number;
    onlyWithoutWebsite?: boolean;
    onlyWithPhone?: boolean;
}

export const searchLeads = async (query: string, city: string, filters: SearchFilters = {}) => {
    if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'SUA_CHAVE_AQUI') {
        console.warn('Google Places API Key not configured. Returning mock data.');
        return getMockLeads(query, city);
    }

    try {
        // 1. Converte cidade para lat/lng via Geocoding
        const geoResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
            params: {
                address: city,
                key: GOOGLE_PLACES_API_KEY
            }
        });

        if (geoResponse.data.status !== 'OK') {
            throw new Error('City not found');
        }

        const { lat, lng } = geoResponse.data.results[0].geometry.location;

        // 2. Consulta Places API (Text Search) com raio personalizado
        const searchRadius = filters.radius || 10000; // padrão 10km
        const placesResponse = await axios.get(`https://maps.googleapis.com/maps/api/place/textsearch/json`, {
            params: {
                query: `${query} em ${city}`,
                location: `${lat},${lng}`,
                radius: searchRadius,
                key: GOOGLE_PLACES_API_KEY
            }
        });

        const results = placesResponse.data.results;

        // 3. Busca detalhes para cada lugar (especialmente o website)
        // Limitamos a 20 resultados para evitar lentidão e custos excessivos
        const detailedLeads = await Promise.all(
            results.slice(0, 20).map(async (place: any) => {
                try {
                    const detailsResponse = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
                        params: {
                            place_id: place.place_id,
                            fields: 'name,formatted_phone_number,website,rating,user_ratings_total,types,address_components,formatted_address,photos',
                            key: GOOGLE_PLACES_API_KEY
                        }
                    });

                    const details = detailsResponse.data.result || place;
                    const photoReference = details.photos?.[0]?.photo_reference;
                    const imageUrl = photoReference
                        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`
                        : null;

                    // Extrai cidade e estado reais do Google
                    let cityFromGoogle = '';
                    let stateFromGoogle = '';

                    if (details.address_components) {
                        const cityComp = details.address_components.find((c: any) =>
                            c.types.includes('administrative_area_level_2') || c.types.includes('locality')
                        );
                        const stateComp = details.address_components.find((c: any) =>
                            c.types.includes('administrative_area_level_1')
                        );
                        cityFromGoogle = cityComp ? cityComp.long_name : city;
                        stateFromGoogle = stateComp ? stateComp.short_name : 'N/A';
                    } else {
                        cityFromGoogle = city;
                        stateFromGoogle = 'N/A';
                    }

                    const socialMediaDomains = ['facebook.com', 'instagram.com', 'whatsapp.com', 'wa.me', 'youtube.com', 'linkedin.com', 'linktr.ee'];
                    const website = details.website;
                    const hasOwnWebsite = website && !socialMediaDomains.some(domain => website.toLowerCase().includes(domain));

                    const leadInfo: LeadData = {
                        name: details.name || place.name,
                        address: details.formatted_address || place.formatted_address,
                        website: website,
                        rating: details.rating || place.rating,
                        user_ratings_total: details.user_ratings_total || place.user_ratings_total,
                        phone: details.formatted_phone_number || place.formatted_phone_number,
                        segment: query,
                        image_url: imageUrl
                    };

                    const location = place.geometry?.location;

                    return {
                        ...leadInfo,
                        city: cityFromGoogle,
                        state: stateFromGoogle,
                        score: calculateScore(leadInfo),
                        status: 'new',
                        place_id: place.place_id,
                        has_own_website: !!hasOwnWebsite,
                        origin: 'google_places',
                        latitude: location?.lat,
                        longitude: location?.lng
                    };
                } catch (err) {
                    console.error(`Error fetching details for ${place.name}:`, err);
                    return null;
                }
            })
        );

        // 4. Aplica filtros avançados
        let filteredLeads = detailedLeads.filter(l => l !== null);

        // Filtro de avaliação mínima
        if (filters.minRating && filters.minRating > 0) {
            filteredLeads = filteredLeads.filter(lead =>
                lead.rating && lead.rating >= filters.minRating!
            );
        }

        // Filtro de número mínimo de avaliações
        if (filters.minReviews && filters.minReviews > 0) {
            filteredLeads = filteredLeads.filter(lead =>
                lead.user_ratings_total && lead.user_ratings_total >= filters.minReviews!
            );
        }

        // Filtro de empresas sem site
        if (filters.onlyWithoutWebsite) {
            filteredLeads = filteredLeads.filter(lead => !lead.has_own_website);
        }

        // Filtro de telefone obrigatório
        if (filters.onlyWithPhone) {
            filteredLeads = filteredLeads.filter(lead => lead.phone);
        }

        console.log(`Filtros aplicados: ${filteredLeads.length} leads de ${detailedLeads.length} originais`);

        return filteredLeads;

    } catch (error) {
        console.error('Error searching leads:', error);
        throw error;
    }
};

const getMockLeads = (query: string, city: string) => {
    return [
        {
            name: `${query} Exemplo 1`,
            segment: query,
            city: city,
            state: "SP",
            phone: "(11) 99999-9999",
            website: null,
            score: 85,
            status: "new",
            place_id: "mock_1"
        },
        {
            name: `${query} Exemplo 2`,
            segment: query,
            city: city,
            state: "SP",
            phone: "(11) 88888-8888",
            website: "http://exemplo.com",
            score: 45,
            status: "new",
            place_id: "mock_2"
        }
    ];
};
