// Simple test for OBJ import/export functionality
// This file can be used for manual testing and validation

import { exportMeshesToOBJ } from './obj-exporter';
import { importOBJFile } from './obj-importer';
import type { Mesh } from '@/types/geometry';
import { createCubeMesh } from './geometry';

// Sample OBJ content for testing
export const SAMPLE_OBJ_CUBE = `# Test cube
v -1.0 -1.0  1.0
v  1.0 -1.0  1.0
v  1.0  1.0  1.0
v -1.0  1.0  1.0
v -1.0 -1.0 -1.0
v  1.0 -1.0 -1.0
v  1.0  1.0 -1.0
v -1.0  1.0 -1.0

vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0

vn 0.0 0.0 1.0
vn 0.0 0.0 -1.0
vn 0.0 1.0 0.0
vn 0.0 -1.0 0.0
vn 1.0 0.0 0.0
vn -1.0 0.0 0.0

# Front face
f 1/1/1 2/2/1 3/3/1 4/4/1
# Back face
f 5/4/2 8/1/2 7/2/2 6/3/2
# Top face
f 4/1/3 3/2/3 7/3/3 8/4/3
# Bottom face
f 1/1/4 5/2/4 6/3/4 2/4/4
# Right face
f 2/1/5 6/2/5 7/3/5 3/4/5
# Left face
f 1/1/6 4/2/6 8/3/6 5/4/6`;

export function testOBJExport(): string {
    try {
        // Create a test cube mesh
        const cube = createCubeMesh(2);
        
        // Export to OBJ
        const result = exportMeshesToOBJ([cube], {
            includeNormals: true,
            includeUVs: true,
            exportMaterials: false
        });
        
        console.log('OBJ Export Test Results:');
        console.log('- Filename:', result.filename);
        console.log('- Warnings:', result.warnings);
        console.log('- Content length:', result.objContent.length);
        console.log('- Content preview:', result.objContent.substring(0, 200) + '...');
        
        return result.objContent;
    } catch (error) {
        console.error('OBJ Export Test Failed:', error);
        throw error;
    }
}

export async function testOBJImport(): Promise<void> {
    try {
        // Create a test file from sample OBJ content
        const file = new File([SAMPLE_OBJ_CUBE], 'test-cube.obj', { type: 'text/plain' });
        
        // Import the OBJ
        const result = await importOBJFile(file);
        
        console.log('OBJ Import Test Results:');
        console.log('- Root Group ID:', result.rootGroupId);
        console.log('- Created Objects:', result.createdObjectIds.length);
        console.log('- Created Meshes:', result.createdMeshIds.length);
        console.log('- Created Materials:', result.createdMaterialIds.length);
        console.log('- Warnings:', result.warnings);
        
        if (result.warnings.length > 0) {
            console.warn('Import warnings:', result.warnings);
        }
        
    } catch (error) {
        console.error('OBJ Import Test Failed:', error);
        throw error;
    }
}

export async function testOBJRoundTrip(): Promise<boolean> {
    try {
        console.log('Starting OBJ Round-trip Test...');
        
        // 1. Create a test mesh
        const originalCube = createCubeMesh(1.5);
        console.log('Original mesh vertices:', originalCube.vertices.length);
        console.log('Original mesh faces:', originalCube.faces.length);
        
        // 2. Export to OBJ
        const exportResult = exportMeshesToOBJ([originalCube], {
            includeNormals: true,
            includeUVs: true,
            exportMaterials: false
        });
        
        // 3. Import the exported OBJ
        const file = new File([exportResult.objContent], 'roundtrip-test.obj', { type: 'text/plain' });
        const importResult = await importOBJFile(file);
        
        // 4. Verify the results
        const success = importResult.createdMeshIds.length === 1 && 
                       importResult.warnings.length === 0;
        
        console.log('Round-trip Test Results:');
        console.log('- Success:', success);
        console.log('- Export warnings:', exportResult.warnings);
        console.log('- Import warnings:', importResult.warnings);
        
        return success;
        
    } catch (error) {
        console.error('OBJ Round-trip Test Failed:', error);
        return false;
    }
}

// Export test functions for use in browser console
if (typeof window !== 'undefined') {
    (window as any).testOBJ = {
        testExport: testOBJExport,
        testImport: testOBJImport,
        testRoundTrip: testOBJRoundTrip,
        sampleCube: SAMPLE_OBJ_CUBE
    };
}