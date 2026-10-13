/** Kleine WebGL2-Helfer: Programme, Uniforms und Render-Targets */

export class GlError extends Error {}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new GlError('createShader fehlgeschlagen');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new GlError(`Shader: ${log}`);
	}
	return shader;
}

export type Program = {
	program: WebGLProgram;
	/** Uniform-Locations, beim ersten Zugriff gecacht */
	u: (name: string) => WebGLUniformLocation | null;
};

export function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
	const program = gl.createProgram();
	if (!program) throw new GlError('createProgram fehlgeschlagen');
	const vertex = compile(gl, gl.VERTEX_SHADER, vs);
	const fragment = compile(gl, gl.FRAGMENT_SHADER, fs);
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
		throw new GlError(`Programm: ${gl.getProgramInfoLog(program)}`);
	}
	const cache = new Map<string, WebGLUniformLocation | null>();
	return {
		program,
		u: (name) => {
			if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
			return cache.get(name) ?? null;
		}
	};
}

export type Target = {
	texture: WebGLTexture;
	framebuffer: WebGLFramebuffer;
	width: number;
	height: number;
};

export function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) throw new GlError('createTexture fehlgeschlagen');
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return texture;
}

export function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
	const w = Math.max(1, Math.round(width));
	const h = Math.max(1, Math.round(height));
	const texture = createTexture(gl);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	const framebuffer = gl.createFramebuffer();
	if (!framebuffer) throw new GlError('createFramebuffer fehlgeschlagen');
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return { texture, framebuffer, width: w, height: h };
}

export function deleteTarget(gl: WebGL2RenderingContext, target: Target) {
	gl.deleteTexture(target.texture);
	gl.deleteFramebuffer(target.framebuffer);
}

export const rgb01 = ([r, g, b]: readonly number[]): [number, number, number] => [
	r / 255,
	g / 255,
	b / 255
];
