import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// Set up Three.js basics
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lighting for visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5).normalize();
scene.add(directionalLight);

// Position the camera and set OrbitControls target
camera.position.set(0, 0, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;

// Raycaster for mouse interactions
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Tooltip for flight information
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
tooltip.style.color = 'white';
tooltip.style.padding = '5px';
tooltip.style.borderRadius = '5px';
tooltip.style.pointerEvents = 'none';
tooltip.style.visibility = 'hidden';
document.body.appendChild(tooltip);

// Store stars for flickering effect
const stars = [];

// Function to create a star field with colorful and emissive stars
function addStars(count = 1000) {
    const starGeometry = new THREE.SphereGeometry(0.1, 8, 8);

    for (let i = 0; i < count; i++) {
        const color = new THREE.Color(Math.random(), Math.random(), Math.random());

        const starMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1,
            transparent: true,
            opacity: 0.8
        });

        const star = new THREE.Mesh(starGeometry, starMaterial);

        // Random position for the star
        star.position.x = THREE.MathUtils.randFloatSpread(200);
        star.position.y = THREE.MathUtils.randFloatSpread(200);
        star.position.z = THREE.MathUtils.randFloatSpread(200);

        stars.push(star); // Store star mesh for flickering effect
        scene.add(star);
    }
}

// Call addStars to create a colorful starry background
addStars(1000);

// Function to convert lat/lon/alt to 3D coordinates
function latLonToVector3(lat, lon, altitude) {
    const radius = 10 + altitude / 80000;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}

// Array to store positions of points
const pointPositions = [];
const flightPoints = []; // Store flight point meshes

// Fetch and plot flight data using AllOrigins proxy
async function fetchAndPlotFlightData() {
    try {
        const apiUrl = encodeURIComponent('http://api.aviationstack.com/v1/flights?access_key=ad35ca5faa35ce5583bd82c877f6b910&flight_status=active&limit=30');
        const response = await fetch(`https://api.allorigins.win/get?url=${apiUrl}`);
        const data = await response.json();

        // Parse the JSON data from the contents
        const flightData = JSON.parse(data.contents);
        console.log('API Response:', flightData);

        flightData.data.forEach(flight => {
            if (flight.flight_status === 'active' && flight.live && flight.live.latitude && flight.live.longitude && flight.live.altitude) {
                const position = latLonToVector3(
                    flight.live.latitude,
                    flight.live.longitude,
                    flight.live.altitude - 5
                );

                // Create main flight point
                const pointGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: true });
                const point = new THREE.Mesh(pointGeometry, pointMaterial);
                point.position.copy(position);
                scene.add(point);

                // Create glowing effect
                const glowGeometry = new THREE.SphereGeometry(0.3, 16, 16); // Slightly larger than the point
                const glowMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.3,
                    depthWrite: false
                });
                const glow = new THREE.Mesh(glowGeometry, glowMaterial);
                glow.position.copy(position);
                scene.add(glow);

                pointPositions.push(position);
                flightPoints.push({ point, flight }); // Store the point and associated flight data
            }
        });

        // Draw constellation lines between the points
        drawConstellationLines(pointPositions.slice(0, 50)); // Connect the first 50 points

    } catch (error) {
        console.error('Error fetching flight data:', error);
    }
}

// Function to draw lines between consecutive points
function drawConstellationLines(positions) {
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });
    for (let i = 0; i < positions.length - 1; i++) {
        const points = [positions[i], positions[i + 1]];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
    }
}

// Set up post-processing for bloom effect
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass();
bloomPass.threshold = 0.1; // Threshold for bloom
bloomPass.strength = 1.5;   // Strength of the bloom effect
bloomPass.radius = 0.5;     // Radius of the bloom
composer.addPass(bloomPass);

// Mouse movement event listener
window.addEventListener('mousemove', (event) => {
    // Normalize mouse coordinates to range from -1 to +1
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(flightPoints.map(fp => fp.point));

    if (intersects.length > 0) {
        const firstIntersected = intersects[0];
        const flightInfo = flightPoints.find(fp => fp.point === firstIntersected.object).flight;

        tooltip.innerHTML = `
            <strong>Flight Info:</strong><br>
            Airline: ${flightInfo.airline.name}<br>
            Flight: ${flightInfo.flight.iata}<br>
            Departure: ${flightInfo.departure.iata} - ${flightInfo.departure.estimated}<br>
            Arrival: ${flightInfo.arrival.iata} - ${flightInfo.arrival.estimated}
        `;
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
        tooltip.style.visibility = 'visible';
    } else {
        tooltip.style.visibility = 'hidden';
    }
});

// Call function to fetch and display flight data
fetchAndPlotFlightData();

// Render loop
function animate() {
    requestAnimationFrame(animate);
    
    // Flicker effect for stars
    stars.forEach(star => {
        const flicker = Math.random() * 0.1; // Random flicker amount
        star.material.opacity = 0.5 + flicker; // Vary opacity slightly
    });

    controls.update();
    composer.render(); // Render using composer for bloom effect
}

animate();
