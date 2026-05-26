import React, { useRef, useEffect } from 'react';

const ThreeDViewer = ({ fileUrl, fileName }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!fileUrl || !containerRef.current) return;

    let rendererObj = null;
    let resizeHandler = null;

    const loadScripts = async () => {
      try {
        // Load Three.js core
        const threeScript = document.createElement('script');
        threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        threeScript.async = true;
        document.head.appendChild(threeScript);

        threeScript.onload = async () => {
          // Load FBXLoader after Three.js is loaded
          const fbxScript = document.createElement('script');
          fbxScript.src = 'https://cdn.jsdelivr.net/npm/three@r128/examples/js/loaders/FBXLoader.js';
          fbxScript.async = true;
          document.head.appendChild(fbxScript);

          fbxScript.onload = () => {
            // Load fflate library which FBXLoader depends on for zlib compression
            const fflateScript = document.createElement('script');
            fflateScript.src = 'https://cdn.jsdelivr.net/npm/fflate@0.8.0/umd/index.min.js';
            fflateScript.async = true;
            document.head.appendChild(fflateScript);
            
            fflateScript.onload = () => {
              initThree();
            };
          };
        };
      } catch (err) {
        console.error('Failed to load 3D viewer scripts:', err);
      }
    };

    const initThree = () => {
      if (!window.THREE) return;

      const THREE = window.THREE;
      const scene = new THREE.Scene();
      
      // Background hex 1973790 is 0x1e1e1e (dark gray)
      scene.background = new THREE.Color(0x1e1e1e);
      scene.fog = new THREE.Fog(0x1e1e1e, 100, 1000);

      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 50);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      rendererObj = renderer;
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      
      // Clear previous canvases if any
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 20, 10);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
      scene.add(gridHelper);

      const axesHelper = new THREE.AxesHelper(5);
      scene.add(axesHelper);

      // Load model
      const loader = new THREE.FBXLoader();
      loader.load(
        fileUrl,
        (fbx) => {
          console.log('Model loaded successfully:', fbx);
          scene.add(fbx);

          // Center camera around loaded object bounds
          const box = new THREE.Box3().setFromObject(fbx);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fovRad = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fovRad / 2));
          cameraZ *= 1.5; // Add zoom buffer
          
          camera.position.z = cameraZ;
          camera.lookAt(box.getCenter(new THREE.Vector3()));

          // Orbit Rotation Controls
          let isDragging = false;
          let previousMousePosition = { x: 0, y: 0 };

          const onMouseDown = (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
          };

          const onMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            
            fbx.rotation.y += deltaX * 0.005;
            fbx.rotation.x += deltaY * 0.005;
            
            previousMousePosition = { x: e.clientX, y: e.clientY };
          };

          const onMouseUp = () => {
            isDragging = false;
          };

          const onWheel = (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            if (e.deltaY > 0) {
              camera.position.z *= (1 + zoomSpeed);
            } else {
              camera.position.z *= (1 - zoomSpeed);
            }
          };

          renderer.domElement.addEventListener('mousedown', onMouseDown);
          renderer.domElement.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          renderer.domElement.addEventListener('wheel', onWheel);

          // Animation loop
          let reqId;
          const animate = () => {
            reqId = requestAnimationFrame(animate);
            renderer.render(scene, camera);
          };
          animate();

          // Handle Resize
          const handleResize = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
          };
          window.addEventListener('resize', handleResize);
          resizeHandler = handleResize;

          // Cleanup event listeners
          return () => {
            cancelAnimationFrame(reqId);
            if (renderer.domElement) {
              renderer.domElement.removeEventListener('mousedown', onMouseDown);
              renderer.domElement.removeEventListener('mousemove', onMouseMove);
              renderer.domElement.removeEventListener('wheel', onWheel);
            }
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
          };
        },
        undefined,
        (error) => {
          console.error('Error loading FBX model:', error);
          if (containerRef.current) {
            containerRef.current.innerHTML = '<div class="model-error">Failed to load 3D model</div>';
          }
        }
      );
    };

    loadScripts();

    return () => {
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (rendererObj) {
        rendererObj.dispose();
      }
    };
  }, [fileUrl]);

  return (
    <div className="three-d-viewer">
      <div className="viewer-header-3d">
        <span className="viewer-title-3d">3D Model Viewer</span>
        <span className="viewer-hint-3d">Drag to rotate • Scroll to zoom</span>
      </div>
      <div ref={containerRef} className="three-d-container" />
    </div>
  );
};

export default ThreeDViewer;
