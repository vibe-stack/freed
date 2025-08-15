'use client';

import React from 'react';
import { useCameraController } from '../hooks/use-camera-controller';

const CameraController: React.FC = () => {
  useCameraController();
  return null;
};

export default CameraController;
