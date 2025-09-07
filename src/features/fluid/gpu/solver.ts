// Minimal GPU fluid solver (PBF) with grid hashing and SDF collision
import { FluidSystemConfig } from '@/stores/fluid-store';

export interface FluidGPUSolverOptions { capacity: number; gridResolution: [number, number, number]; radius: number; }

export class FluidGPUSolver {
  device: GPUDevice; capacity: number; gridResolution: [number, number, number]; radius: number;
  buffers: Record<string, GPUBuffer> = {}; pipelines: Record<string, GPUComputePipeline> = {}; bindGroups: Record<string, GPUBindGroup> = {}; layout: GPUBindGroupLayout | null = null; sampler: GPUSampler;
  sdfTexture: GPUTexture | null = null; sdfInfo: { worldToGrid: Float32Array; bboxMin: Float32Array; bboxMax: Float32Array } | null = null;
  aliveCount = 0;
  constructor(device: GPUDevice, opts: FluidGPUSolverOptions) { this.device = device; this.capacity = opts.capacity; this.gridResolution = opts.gridResolution; this.radius = opts.radius; this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' }); this.initBuffers(); this.initPipelines(); }
  initBuffers() {
    const cap = this.capacity; const create = (size: number, usage: GPUBufferUsageFlags, label: string) => this.device.createBuffer({ size, usage, label });
    this.buffers.positions = create(cap * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, 'fluid_positions');
    this.buffers.prevPositions = create(cap * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'fluid_prev_positions');
    this.buffers.velocities = create(cap * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, 'fluid_velocities');
    this.buffers.lambdas = create(cap * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'fluid_lambdas');
    this.buffers.deltas = create(cap * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'fluid_deltas');
    this.buffers.alive = create(cap * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'fluid_alive');
    const cells = this.gridResolution[0] * this.gridResolution[1] * this.gridResolution[2];
    this.buffers.cellHeads = create(cells * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'fluid_cell_heads');
    this.buffers.next = create(cap * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'fluid_next');
    this.buffers.params = create(4 * 64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'fluid_params');
  }
  initPipelines() {
  const code = /* wgsl */`struct Params {\n  dt: f32; substeps: u32; iter: u32; capacity: u32;\n  radius: f32; restDensity: f32; viscosity: f32; bounce: f32;\n  gravity: vec3<f32>; drag: f32;\n  gridSize: vec3<u32>; _pad1: f32;\n  bboxMin: vec3<f32>; _pad2: f32;\n  bboxMax: vec3<f32>; _pad3: f32;\n  worldToGrid: mat4x4<f32>;\n};\n@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;\n@group(0) @binding(1) var<storage, read_write> prevPositions: array<vec4<f32>>;\n@group(0) @binding(2) var<storage, read_write> velocities: array<vec4<f32>>;\n@group(0) @binding(3) var<storage, read_write> lambdas: array<f32>;\n@group(0) @binding(4) var<storage, read_write> deltas: array<vec4<f32>>;\n@group(0) @binding(5) var<storage, read_write> alive: array<u32>;\n@group(0) @binding(6) var<storage, read_write> cellHeads: array<atomic<i32>>;\n@group(0) @binding(7) var<storage, read_write> nextPtr: array<i32>;\n@group(0) @binding(8) var<uniform> params: Params;\n@group(0) @binding(9) var sdfTex: texture_3d<f32>;\n@group(0) @binding(10) var sdfSampler: sampler;\nfn cellIndex(p: vec3<f32>) -> u32 { let g = (params.worldToGrid * vec4<f32>(p,1.0)).xyz; let gx = clamp(i32(floor(g.x * f32(params.gridSize.x))),0,i32(params.gridSize.x)-1); let gy = clamp(i32(floor(g.y * f32(params.gridSize.y))),0,i32(params.gridSize.y)-1); let gz = clamp(i32(floor(g.z * f32(params.gridSize.z))),0,i32(params.gridSize.z)-1); return u32(gx + gy * i32(params.gridSize.x) + gz * i32(params.gridSize.x) * i32(params.gridSize.y)); }\nfn poly6(r2: f32, h: f32) -> f32 { if (r2 >= h*h) { return 0.0; } let k = 315.0 / (64.0 * 3.14159265 * pow(h,9.0)); let x = h*h - r2; return k * x*x*x; }\nfn spikyGrad(r: vec3<f32>, h: f32) -> vec3<f32> { let rl = length(r); if (rl == 0.0 || rl >= h) { return vec3<f32>(0.0); } let k = -45.0 / (3.14159265 * pow(h,6.0)) * pow(h - rl, 2.0); return k * r/rl; }\n@compute @workgroup_size(128) fn clearGrid(@builtin(global_invocation_id) gid: vec3<u32>) { let idx = gid.x; if (idx < params.gridSize.x * params.gridSize.y * params.gridSize.z) { atomicStore(&cellHeads[idx], -1); } }\n@compute @workgroup_size(128) fn integrateAndHash(@builtin(global_invocation_id) gid: vec3<u32>) { let i = gid.x; if (i >= params.capacity) { return; } if (alive[i]==0u) { return; } let dt = params.dt; prevPositions[i] = positions[i]; var pos = positions[i].xyz; var vel = velocities[i].xyz; vel += params.gravity * dt; vel *= (1.0 - params.drag); pos += vel * dt; let uvw = (params.worldToGrid * vec4<f32>(pos,1.0)).xyz; if (all(uvw >= vec3<f32>(0.0)) && all(uvw <= vec3<f32>(1.0))) { let d = textureSampleLevel(sdfTex, sdfSampler, uvw, 0.0).r; if (d < 0.0) { let e = 1.0/64.0; let gx = textureSampleLevel(sdfTex, sdfSampler, uvw+vec3<f32>(e,0,0),0.0).r - textureSampleLevel(sdfTex, sdfSampler, uvw-vec3<f32>(e,0,0),0.0).r; let gy = textureSampleLevel(sdfTex, sdfSampler, uvw+vec3<f32>(0,e,0),0.0).r - textureSampleLevel(sdfTex, sdfSampler, uvw-vec3<f32>(0,e,0),0.0).r; let gz = textureSampleLevel(sdfTex, sdfSampler, uvw+vec3<f32>(0,0,e),0.0).r - textureSampleLevel(sdfTex, sdfSampler, uvw-vec3<f32>(0,0,e),0.0).r; var n = normalize(vec3<f32>(gx,gy,gz)); pos -= n * d * 0.9; vel = reflect(vel, n) * params.bounce; } } positions[i] = vec4<f32>(pos,0.0); velocities[i] = vec4<f32>(vel,0.0); let cell = cellIndex(pos); let prior = atomicExchange(&cellHeads[cell], i32(i)); nextPtr[i] = prior; }\n@compute @workgroup_size(128) fn solve(@builtin(global_invocation_id) gid: vec3<u32>) { let i = gid.x; if (i >= params.capacity) { return; } if (alive[i]==0u){return;} let h = params.radius; let rest = params.restDensity; let eps = 1e-5; let pos = positions[i].xyz; var density = poly6(0.0,h); let cs = params.gridSize; let g = (params.worldToGrid * vec4<f32>(pos,1.0)).xyz; let gx = clamp(i32(floor(g.x * f32(cs.x))),0,i32(cs.x)-1); let gy = clamp(i32(floor(g.y * f32(cs.y))),0,i32(cs.y)-1); let gz = clamp(i32(floor(g.z * f32(cs.z))),0,i32(cs.z)-1); for (var dx = -1; dx <= 1; dx++) { for (var dy = -1; dy <= 1; dy++) { for (var dz = -1; dz <= 1; dz++) { let nx = clamp(gx+dx,0,i32(cs.x)-1); let ny = clamp(gy+dy,0,i32(cs.y)-1); let nz = clamp(gz+dz,0,i32(cs.z)-1); let cell = u32(nx + ny * i32(cs.x) + nz * i32(cs.x) * i32(cs.y)); var ptr = atomicLoad(&cellHeads[cell]); loop { if (ptr==-1) { break; } let j = u32(ptr); if (j!=i && alive[j]==1u) { let rij = pos - positions[j].xyz; let r2 = dot(rij,rij); density += poly6(r2,h); } ptr = nextPtr[j]; } } } } let C = density / rest - 1.0; var sumGrad2 = 0.0; var gradI = vec3<f32>(0.0); for (var dx = -1; dx <= 1; dx++) { for (var dy = -1; dy <= 1; dy++) { for (var dz = -1; dz <= 1; dz++) { let nx = clamp(gx+dx,0,i32(cs.x)-1); let ny = clamp(gy+dy,0,i32(cs.y)-1); let nz = clamp(gz+dz,0,i32(cs.z)-1); let cell = u32(nx + ny * i32(cs.x) + nz * i32(cs.x) * i32(cs.y)); var ptr = atomicLoad(&cellHeads[cell]); loop { if (ptr==-1) { break; } let j = u32(ptr); if (j!=i && alive[j]==1u) { let rij = pos - positions[j].xyz; let grad = spikyGrad(rij,h)/rest; sumGrad2 += dot(grad,grad); gradI += grad; } ptr = nextPtr[j]; } } } } sumGrad2 += dot(gradI, gradI); let lambda = -C / (sumGrad2 + eps); lambdas[i] = lambda; var delta = vec3<f32>(0.0); let scorrK = 0.01; let scorrN = 4.0; let w0 = poly6(0.0,h); for (var dx = -1; dx <= 1; dx++) { for (var dy = -1; dy <= 1; dy++) { for (var dz = -1; dz <= 1; dz++) { let nx = clamp(gx+dx,0,i32(cs.x)-1); let ny = clamp(gy+dy,0,i32(cs.y)-1); let nz = clamp(gz+dz,0,i32(cs.z)-1); let cell = u32(nx + ny * i32(cs.x) + nz * i32(cs.x) * i32(cs.y)); var ptr = atomicLoad(&cellHeads[cell]); loop { if (ptr==-1) { break; } let j = u32(ptr); if (j!=i && alive[j]==1u) { let rij = pos - positions[j].xyz; let r = length(rij); if (r < h && r > 0.0) { let grad = spikyGrad(rij,h)/rest; let w = poly6(r*r,h); let corr = -scorrK * pow(w / w0, scorrN); delta += grad * (lambda + lambdas[j] + corr); } } ptr = nextPtr[j]; } } } } deltas[i] = vec4<f32>(delta,0.0); }\n@compute @workgroup_size(128) fn applyDelta(@builtin(global_invocation_id) gid: vec3<u32>) { let i = gid.x; if (i>=params.capacity) { return; } if (alive[i]==0u){return;} var pos = positions[i].xyz; pos += deltas[i].xyz; positions[i] = vec4<f32>(pos,0.0); var vel = (pos - prevPositions[i].xyz) / params.dt; let vmax = 25.0; let lsq = dot(vel,vel); if (lsq > vmax*vmax) { vel = normalize(vel) * vmax; } velocities[i] = vec4<f32>(vel,0.0); }\n@compute @workgroup_size(128) fn viscosity(@builtin(global_invocation_id) gid: vec3<u32>) { let i = gid.x; if (i>=params.capacity) { return; } if (alive[i]==0u){return;} let h = params.radius; let pos = positions[i].xyz; var vel = velocities[i].xyz; let cs = params.gridSize; let g = (params.worldToGrid * vec4<f32>(pos,1.0)).xyz; let gx = clamp(i32(floor(g.x * f32(cs.x))),0,i32(cs.x)-1); let gy = clamp(i32(floor(g.y * f32(cs.y))),0,i32(cs.y)-1); let gz = clamp(i32(floor(g.z * f32(cs.z))),0,i32(cs.z)-1); var avg = vec3<f32>(0.0); var count = 0.0; for (var dx=-1; dx<=1; dx++) { for (var dy=-1; dy<=1; dy++) { for (var dz=-1; dz<=1; dz++) { let nx = clamp(gx+dx,0,i32(cs.x)-1); let ny = clamp(gy+dy,0,i32(cs.y)-1); let nz = clamp(gz+dz,0,i32(cs.z)-1); let cell = u32(nx + ny * i32(cs.x) + nz * i32(cs.x) * i32(cs.y)); var ptr = atomicLoad(&cellHeads[cell]); loop { if (ptr==-1) { break; } let j = u32(ptr); if (j!=i && alive[j]==1u) { let rij = pos - positions[j].xyz; if (dot(rij,rij) < h*h) { avg += velocities[j].xyz; count += 1.0; } } ptr = nextPtr[j]; } } } } if (count > 0.0) { avg /= count; vel = mix(vel, avg, params.viscosity); } velocities[i] = vec4<f32>(vel,0.0); }`;
  const shaderModule = this.device.createShaderModule({ code });
    const entries: GPUBindGroupLayoutEntry[] = [];
    for (let i = 0; i <= 8; i++) {
      entries.push({ binding: i, visibility: GPUShaderStage.COMPUTE, buffer: { type: i === 8 ? 'uniform' : 'read-write' as GPUBufferBindingType } });
    }
    entries.push({ binding: 9, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'read-only', format: 'r32float', viewDimension: '3d' } });
    entries.push({ binding: 10, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' } });
    this.layout = this.device.createBindGroupLayout({ entries });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.layout] });
  const mk = (entryPoint: string) => this.device.createComputePipeline({ layout: pipelineLayout, compute: { module: shaderModule, entryPoint } });
    this.pipelines.clearGrid = mk('clearGrid');
    this.pipelines.integrateAndHash = mk('integrateAndHash');
    this.pipelines.solve = mk('solve');
  this.pipelines.applyDelta = mk('applyDelta');
  this.pipelines.viscosity = mk('viscosity');
    this.updateBindGroup();
  }
  updateBindGroup() {
    if (!this.layout) return;
    this.bindGroups.main = this.device.createBindGroup({ layout: this.layout, entries: [
      { binding: 0, resource: { buffer: this.buffers.positions } },
      { binding: 1, resource: { buffer: this.buffers.prevPositions } },
      { binding: 2, resource: { buffer: this.buffers.velocities } },
      { binding: 3, resource: { buffer: this.buffers.lambdas } },
      { binding: 4, resource: { buffer: this.buffers.deltas } },
      { binding: 5, resource: { buffer: this.buffers.alive } },
      { binding: 6, resource: { buffer: this.buffers.cellHeads } },
      { binding: 7, resource: { buffer: this.buffers.next } },
      { binding: 8, resource: { buffer: this.buffers.params } },
      { binding: 9, resource: (this.sdfTexture || this.device.createTexture({ size: { width: 1, height: 1, depthOrArrayLayers: 1 }, format: 'r32float', usage: GPUTextureUsage.TEXTURE_BINDING }).createView({ dimension: '3d' })) },
      { binding: 10, resource: this.sampler },
    ] });
  }
  setSDF(sdf: { texture: GPUTexture; worldToGrid: Float32Array; bboxMin: [number, number, number]; bboxMax: [number, number, number] }) { this.sdfTexture = sdf.texture; this.sdfInfo = { worldToGrid: sdf.worldToGrid, bboxMin: new Float32Array(sdf.bboxMin), bboxMax: new Float32Array(sdf.bboxMax) }; this.updateBindGroup(); }
  writeParams(cfg: FluidSystemConfig, dt: number) {
    if (!this.sdfInfo) return; const data = new Float32Array(64);
    data[0] = dt; data[1] = cfg.substeps; data[2] = cfg.solverIterations; data[3] = this.capacity;
    data[4] = cfg.radius; data[5] = cfg.restDensity; data[6] = cfg.viscosity; data[7] = cfg.bounce;
  data[8] = cfg.gravity.x; data[9] = cfg.gravity.y; data[10] = cfg.gravity.z; data[11] = cfg.drag;
    data[12] = this.gridResolution[0]; data[13] = this.gridResolution[1]; data[14] = this.gridResolution[2];
    data[16] = this.sdfInfo.bboxMin[0]; data[17] = this.sdfInfo.bboxMin[1]; data[18] = this.sdfInfo.bboxMin[2];
    data[20] = this.sdfInfo.bboxMax[0]; data[21] = this.sdfInfo.bboxMax[1]; data[22] = this.sdfInfo.bboxMax[2];
    this.device.queue.writeBuffer(this.buffers.params, 0, data.buffer);
    // worldToGrid matrix at offset 32 (16 floats)
    this.device.queue.writeBuffer(this.buffers.params, 32 * 4, this.sdfInfo.worldToGrid.buffer ?? this.sdfInfo.worldToGrid);
  }
  emit(count: number, pos: [number, number, number]) {
    const start = this.aliveCount; const end = Math.min(this.capacity, start + count); if (end <= start) return;
    const range = end - start; const posData = new Float32Array(range * 4); const velData = new Float32Array(range * 4); const aliveData = new Uint32Array(range);
    for (let i = 0; i < range; i++) { const off = i * 4; posData[off] = pos[0]; posData[off+1] = pos[1]; posData[off+2] = pos[2]; velData[off] = 0; velData[off+1] = 0; velData[off+2] = 0; aliveData[i] = 1; }
    this.device.queue.writeBuffer(this.buffers.positions, start * 16, posData); this.device.queue.writeBuffer(this.buffers.prevPositions, start * 16, posData); this.device.queue.writeBuffer(this.buffers.velocities, start * 16, velData); this.device.queue.writeBuffer(this.buffers.alive, start * 4, aliveData);
    this.aliveCount = end;
  }
  step(cfg: FluidSystemConfig, dtFrame: number) {
    const sub = Math.max(1, cfg.substeps|0); const dt = dtFrame / sub;
    for (let s = 0; s < sub; s++) {
      this.writeParams(cfg, dt);
      const enc = this.device.createCommandEncoder();
      const cells = this.gridResolution[0] * this.gridResolution[1] * this.gridResolution[2];
      { const pass = enc.beginComputePass(); pass.setPipeline(this.pipelines.clearGrid); pass.setBindGroup(0, this.bindGroups.main!); pass.dispatchWorkgroups(Math.ceil(cells / 128)); pass.end(); }
      { const pass = enc.beginComputePass(); pass.setPipeline(this.pipelines.integrateAndHash); pass.setBindGroup(0, this.bindGroups.main!); pass.dispatchWorkgroups(Math.ceil(this.capacity / 128)); pass.end(); }
      for (let i = 0; i < cfg.solverIterations; i++) {
        { const pass = enc.beginComputePass(); pass.setPipeline(this.pipelines.solve); pass.setBindGroup(0, this.bindGroups.main!); pass.dispatchWorkgroups(Math.ceil(this.capacity / 128)); pass.end(); }
        { const pass = enc.beginComputePass(); pass.setPipeline(this.pipelines.applyDelta); pass.setBindGroup(0, this.bindGroups.main!); pass.dispatchWorkgroups(Math.ceil(this.capacity / 128)); pass.end(); }
      }
      { const pass = enc.beginComputePass(); pass.setPipeline(this.pipelines.viscosity); pass.setBindGroup(0, this.bindGroups.main!); pass.dispatchWorkgroups(Math.ceil(this.capacity / 128)); pass.end(); }
      this.device.queue.submit([enc.finish()]);
    }
  }
  readPositions(): Promise<Float32Array> { const size = this.capacity * 16; const staging = this.device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); const enc = this.device.createCommandEncoder(); enc.copyBufferToBuffer(this.buffers.positions, 0, staging, 0, size); this.device.queue.submit([enc.finish()]); return staging.mapAsync(GPUMapMode.READ).then(() => new Float32Array(staging.getMappedRange().slice(0))).finally(() => staging.destroy()); }
}
