import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// Shared premium glass material properties
const glassMaterialProps = {
  transmission: 0.95,
  opacity: 1,
  metalness: 0.1,
  roughness: 0.1,
  ior: 1.5,
  thickness: 2.5,
  specularIntensity: 1,
  clearcoat: 1,
  transparent: true,
};

const BaseScene = ({ children, isHovered, color }: any) => {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-5, 5, -5]} intensity={0.8} color={color} />
      
      <Float
        speed={isHovered ? 3 : 1.5}
        rotationIntensity={isHovered ? 0.3 : 0.15}
        floatIntensity={isHovered ? 1.5 : 0.8}
        floatingRange={[-0.1, 0.1]}
      >
        {/* Base isometric-like angle */}
        <group position={[0, isHovered ? 0.3 : 0, 0]} rotation={[0.4, -0.6, 0]}>
          {children}
        </group>
      </Float>

      <ContactShadows 
        position={[0, -1.4, 0]} 
        opacity={isHovered ? 0.8 : 0.5} 
        scale={6} 
        blur={2.5} 
        far={4} 
        color={color}
      />
      {/* Studio lighting environment */}
      <Environment preset="city" />
    </>
  );
};

export const ReceptionIcon = ({ isActive, isHovered }: any) => (
  <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }}>
    <BaseScene isHovered={isHovered} color="#34d399">
      {/* Tray base */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[2.2, 0.2, 2.8]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#a7f3d0" />
      </mesh>
      {/* Tray walls */}
      <mesh position={[-1.0, 0.1, 0]}>
        <boxGeometry args={[0.2, 1.0, 2.8]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#a7f3d0" />
      </mesh>
      <mesh position={[1.0, 0.1, 0]}>
        <boxGeometry args={[0.2, 1.0, 2.8]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#a7f3d0" />
      </mesh>
      <mesh position={[0, 0.1, -1.3]}>
        <boxGeometry args={[1.8, 1.0, 0.2]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#a7f3d0" />
      </mesh>
      {/* Document */}
      <mesh position={[0, 0.3, 0]} rotation={[-0.2, 0.1, 0]}>
        <boxGeometry args={[1.6, 0.05, 2.0]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ffffff" transmission={0.4} />
      </mesh>
    </BaseScene>
  </Canvas>
);

export const EmailIcon = ({ isActive, isHovered }: any) => {
  const OrbitingCard = ({ offset, speed }: any) => {
    const ref = useRef<THREE.Mesh>(null!);
    useFrame((state) => {
      const t = state.clock.getElapsedTime() * speed + offset;
      ref.current.position.x = Math.sin(t) * 1.8;
      ref.current.position.z = Math.cos(t) * 1.8;
      ref.current.position.y = Math.sin(t * 2) * 0.6;
      ref.current.rotation.y = t;
    });
    return (
      <mesh ref={ref}>
        <boxGeometry args={[0.8, 0.5, 0.05]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ffffff" transmission={0.3} />
      </mesh>
    );
  };

  return (
    <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }}>
      <BaseScene isHovered={isHovered} color="#a78bfa">
        {/* Envelope body */}
        <mesh>
          <boxGeometry args={[2.4, 1.6, 0.25]} />
          <meshPhysicalMaterial {...glassMaterialProps} color="#ddd6fe" />
        </mesh>
        {/* Envelope flap */}
        <mesh position={[0, 0.8, 0.15]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[1.6, 1.6, 0.1]} />
          <meshPhysicalMaterial {...glassMaterialProps} color="#e9d5ff" />
        </mesh>
        <OrbitingCard offset={0} speed={1} />
        <OrbitingCard offset={Math.PI} speed={0.8} />
      </BaseScene>
    </Canvas>
  );
};

export const CalendarIcon = ({ isActive, isHovered }: any) => (
  <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }}>
    <BaseScene isHovered={isHovered} color="#60a5fa">
      {/* Calendar body */}
      <mesh position={[0, 0, 0]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[2.0, 2.0, 0.4]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#bfdbfe" />
      </mesh>
      {/* Rings */}
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={x} position={[x, 1.0, 0]} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.2, 0.06, 16, 32]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Clock floating */}
      <group position={[1.2, -0.6, 0.8]}>
        <mesh>
          <cylinderGeometry args={[0.7, 0.7, 0.15, 32]} />
          <meshPhysicalMaterial {...glassMaterialProps} color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.08, 0]} rotation={[0, Math.PI/2, 0]}>
          <boxGeometry args={[0.4, 0.04, 0.04]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0.1, 0.08, 0.1]} rotation={[0, -Math.PI/4, 0]}>
          <boxGeometry args={[0.3, 0.04, 0.04]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
    </BaseScene>
  </Canvas>
);

export const ResearchIcon = ({ isActive, isHovered }: any) => (
  <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }}>
    <BaseScene isHovered={isHovered} color="#22d3ee">
      {/* Document */}
      <mesh position={[-0.3, 0, -0.3]}>
        <boxGeometry args={[1.8, 2.2, 0.15]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#a5f3fc" />
      </mesh>
      {/* Data bars */}
      <mesh position={[-0.3, 0.4, -0.18]}>
        <boxGeometry args={[1.3, 0.2, 0.08]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#38bdf8" />
      </mesh>
      <mesh position={[-0.3, 0, -0.18]}>
        <boxGeometry args={[0.9, 0.2, 0.08]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#67e8f9" />
      </mesh>
      
      {/* Magnifying Glass */}
      <group position={[0.6, 0.2, 0.6]} rotation={[0.3, -0.5, 0.3]}>
        {/* Lens Rim */}
        <mesh>
          <torusGeometry args={[0.6, 0.12, 16, 32]} />
          <meshPhysicalMaterial {...glassMaterialProps} color="#ffffff" />
        </mesh>
        {/* Lens Glass */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.08, 32]} />
          <meshPhysicalMaterial {...glassMaterialProps} color="#ffffff" transmission={0.99} ior={1.3} thickness={5} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.6, -0.6, 0]} rotation={[0, 0, Math.PI/4]}>
          <cylinderGeometry args={[0.1, 0.1, 1.0]} />
          <meshPhysicalMaterial {...glassMaterialProps} color="#cffafe" />
        </mesh>
      </group>
    </BaseScene>
  </Canvas>
);

export const ExecutiveIcon = ({ isActive, isHovered }: any) => {
  const CoreNode = ({ offset }: any) => {
    const ref = useRef<THREE.Mesh>(null!);
    useFrame((state) => {
      const t = state.clock.getElapsedTime() + offset;
      ref.current.position.x = Math.sin(t) * 1.5;
      ref.current.position.y = Math.cos(t * 1.8) * 1.5;
      ref.current.position.z = Math.sin(t * 2.2) * 1.5;
    });
    return (
      <mesh ref={ref}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#f472b6" emissive="#f472b6" emissiveIntensity={0.6} />
      </mesh>
    );
  };

  return (
    <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }}>
      <BaseScene isHovered={isHovered} color="#a855f7">
        {/* Core Sphere */}
        <mesh>
          <sphereGeometry args={[1.0, 32, 32]} />
          <meshPhysicalMaterial 
            {...glassMaterialProps} 
            color="#e9d5ff" 
            transmission={0.98} 
            thickness={4} 
          />
        </mesh>
        {/* Inner Glowing Core */}
        <mesh>
          <sphereGeometry args={[0.45, 32, 32]} />
          <meshStandardMaterial color="#d8b4fe" emissive="#a855f7" emissiveIntensity={2.5} />
        </mesh>
        
        <CoreNode offset={0} />
        <CoreNode offset={Math.PI * 0.66} />
        <CoreNode offset={Math.PI * 1.33} />
        <CoreNode offset={Math.PI * 2} />
      </BaseScene>
    </Canvas>
  );
};

export const SubmitIcon = ({ isActive, isHovered }: any) => (
  <Canvas camera={{ position: [0, 0, 6.5], fov: 45 }}>
    <BaseScene isHovered={isHovered} color="#10b981">
      {/* Tray base */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[2.2, 0.2, 2.8]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ccfbf1" />
      </mesh>
      {/* Tray walls */}
      <mesh position={[-1.0, 0.1, 0]}>
        <boxGeometry args={[0.2, 1.0, 2.8]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ccfbf1" />
      </mesh>
      <mesh position={[1.0, 0.1, 0]}>
        <boxGeometry args={[0.2, 1.0, 2.8]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ccfbf1" />
      </mesh>
      <mesh position={[0, 0.1, -1.3]}>
        <boxGeometry args={[1.8, 1.0, 0.2]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ccfbf1" />
      </mesh>
      {/* Document */}
      <mesh position={[0, 0.3, 0]} rotation={[-0.1, 0.2, 0]}>
        <boxGeometry args={[1.6, 0.05, 2.0]} />
        <meshPhysicalMaterial {...glassMaterialProps} color="#ffffff" transmission={0.6} />
      </mesh>
      {/* Checkmark (using two thick rounded boxes approximated by cylinders) */}
      <group position={[0, 0.6, 0.2]} rotation={[-0.1, 0.2, 0]}>
        <mesh position={[-0.3, 0, 0.2]} rotation={[Math.PI/2, 0, Math.PI/4]}>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 16]} />
          <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.1, 0, -0.1]} rotation={[Math.PI/2, 0, -Math.PI/4]}>
          <cylinderGeometry args={[0.1, 0.1, 1.0, 16]} />
          <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </BaseScene>
  </Canvas>
);
