import express, { Request, Response, Router } from 'express' 
import axios from 'axios' 

const router: Router = express.Router() 

// Simple in-memory cache
const cache: Record<string, any> = {};

router.get('/classify', async (req: Request, res: Response) => {
    const { name } = req.query 
    if (name === undefined || name === null || name === "") {
        return res.status(400).json({
            status: "error",
            message: "Missing or empty name parameter"
        }) 
    }
    if (typeof name !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "name is not a string"
        }) 
    }

    const nameKey = name.toLowerCase().trim();

    // Check cache first
    if (cache[nameKey]) {
        console.log(`Cache hit for: ${nameKey}`);
        return res.status(200).json(cache[nameKey]);
    }

    try {
        const apiKey = process.env.GENDERIZE_API_KEY;
        let apiUrl = `https://api.genderize.io/?name=${nameKey}`;
        
        if (apiKey) {
            apiUrl += `&apikey=${apiKey}`;
        }

        const apiResponse = await axios.get(apiUrl) 
        const apiData = apiResponse.data 
        if (apiData.gender === null || apiData.count === 0) {
            return res.status(200).json({
                status: "error",
                message: "No prediction available for the provided name"
            }) 
        }
        const sample_size = apiData.count 
        const probability = apiData.probability
        const is_confident = probability >= 0.7 && sample_size >= 100 
        const processed_at = new Date().toISOString() 
        res.setHeader('Access-Control-Allow-Origin', '*') 
        
        const responseData = {
            status: "success",
            data: {
                name: apiData.name,
                gender: apiData.gender,
                probability: apiData.probability,
                sample_size,
                is_confident,
                processed_at
            }
        };

        // Store in cache
        cache[nameKey] = responseData;

        return res.status(200).json(responseData) 
    } catch (error: any) {
        console.error("Genderize API Error:", error.message || error);
        
        if (error.response && error.response.status === 429) {
            return res.status(429).json({
                status: "error",
                message: "Rate limit exceeded on the external API. Please try again later or use a different name.",
                debug_info: "The external service (genderize.io) is temporarily blocking requests from Render's IP addresses due to high volume."
            })
        }

        return res.status(502).json({
            status: "error",
            message: "Upstream or server failure",
            debug_info: error.message || "Unknown error"
        }) 
    }
}) 

export default router 
