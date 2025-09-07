import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu';
import { convertQuadToTriangles } from '@/utils/geometry';

type Params = {
    displayMesh: any | undefined;
    shading: string;
    isSelected: boolean;
    materials: Map<string, any> | Record<string, any>;
};

export default function useGeometryAndMaterial({ displayMesh, shading, isSelected, materials }: Params) {
    return useMemo<{ geom: BufferGeometry } | null>(() => {
        const dmesh = displayMesh;
        if (!dmesh) return null;

        const geo = new BufferGeometry();
        const vertexMap = new Map(dmesh.vertices.map((v: any) => [v.id, v] as const));
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const uvs2: number[] = [];

        dmesh.faces.forEach((face: any) => {
            const tris = convertQuadToTriangles(face.vertexIds);
            tris.forEach((tri: string[]) => {
                const v0: any = vertexMap.get(tri[0])!; const v1: any = vertexMap.get(tri[1])!; const v2: any = vertexMap.get(tri[2])!;
                const p0 = new Vector3(v0.position.x, v0.position.y, v0.position.z);
                const p1 = new Vector3(v1.position.x, v1.position.y, v1.position.z);
                const p2 = new Vector3(v2.position.x, v2.position.y, v2.position.z);
                const faceNormal = new Vector3()
                    .subVectors(p1, p0)
                    .cross(new Vector3().subVectors(p2, p0))
                    .normalize();
                positions.push(
                    p0.x,
                    p0.y,
                    p0.z,
                    p1.x,
                    p1.y,
                    p1.z,
                    p2.x,
                    p2.y,
                    p2.z
                );
                const loopUV = (vid: string) => {
                    if (!face.uvs) return (vertexMap.get(vid) as any)!.uv;
                    const idx = face.vertexIds.indexOf(vid);
                    return face.uvs[idx] || (vertexMap.get(vid) as any)!.uv;
                };
                const uv0 = loopUV(tri[0]); const uv1 = loopUV(tri[1]); const uv2_ = loopUV(tri[2]);
                uvs.push(uv0.x, uv0.y, uv1.x, uv1.y, uv2_.x, uv2_.y);
                const u20 = v0.uv2 ?? uv0; const u21 = v1.uv2 ?? uv1; const u22 = v2.uv2 ?? uv2_;
                uvs2.push(u20.x, u20.y, u21.x, u21.y, u22.x, u22.y);
                const useSmooth = (dmesh.shading ?? 'flat') === 'smooth';
                if (useSmooth) {
                    const n0 = v0.normal; const n1 = v1.normal; const n2 = v2.normal;
                    normals.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
                } else {
                    for (let i = 0; i < 3; i++) normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
                }
            });
        });

        geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
        if (uvs.length) geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
        if (uvs2.length) geo.setAttribute('uv2', new Float32BufferAttribute(uvs2, 2));
        geo.computeBoundingSphere();

        return { geom: geo };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayMesh, shading, isSelected, materials]);
}
