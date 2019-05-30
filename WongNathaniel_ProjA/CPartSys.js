//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)

// Set 'tab' to 2 spaces (for best on-screen appearance)

/*=================
  PartSys Library
===================
Prototype object that contains a complete particle system:
 -- state-variables s0, s1, & more that each describe a complete set of
  particles at a fixed instant in time. Each state-var is an array of CPart's that
  holds the parameters of this.partCount particles (defined by CPart.js).

 HOW TO USE:
 ---------------
 a) Be sure your WebGL rendering context is available as the global var 'gl'.
 b) Create a PartSys object for each independent particle system
 c) Modify each PartSys object as needed to get desired simulation behvior
 d) Be sure your program's animation loop (e.g. 'tick()' function) calls  'render()'
    of each particle system.
*/

const SYS_NONE          = 0;
const SYS_BOUNCY2D      = 1;
const SYS_BOUNCY3D      = 2;
const SYS_FIRE_REEVES   = 3;
const SYS_TORNADO       = 4;
const SYS_FLOCKING      = 5;
const SYS_SPRING_PAIR   = 6;
const SYS_SPRING_ROPE   = 7;
const SYS_SPRING_CLOTH  = 8;
const SYS_SPRING_SOLID  = 9;
const SYS_ORBITS        =10;
const SYS_GROUND_GRID   =11;

// Array-Name consts that select PartSys objects' numerical-integration solver:
//------------------------------------------------------------------------------
// EXPLICIT methods
const SOLV_EULER       = 0;       // Euler integration: forward,explicit,...
const SOLV_MIDPOINT    = 1;       // Midpoint Method (see Pixar Tutorial)
const SOLV_ADAMS_BASH  = 2;       // Adams-Bashforth Explicit Integrator
const SOLV_RUNGEKUTTA  = 3;       // Arbitrary degree, set by 'solvDegree'
// IMPLICIT methods
const SOLV_BACK_EULER  = 4;       // 'Backwind' or Implicit Euler
const SOLV_BACK_MIDPT  = 5;       // 'Backwind' or Implicit Midpoint
const SOLV_BACK_ADBASH = 6;       // 'Backwind' or Implicit Adams-Bashforth
// OR SEMI-IMPLICIT METHODS
const SOLV_VERLET      = 6;       // Verlet semi-implicit integrator
const SOLV_VEL_VERLET  = 7;       // 'Velocity-Verlet' semi-implicit integrator
const SOLV_LEAPFROG    = 8;       // 'Leapfrog' integrator
const SOLV_SYMPLECTIC  = 9;       // simple semi-implicit integrator
const SOLV_MAX         =10;       // number of solver types available.

const NU_EPSILON  = 10E-15;       // tiny amount; a minimum vector length

function PartSys() {
// Constructor for a new particle system;
  if (arguments.length > 0) {
    this.init(...arguments);
    return;
  }
  this.sysType = SYS_NONE;
}

PartSys.prototype.init = function() {

  if (arguments.length === 0) return;
  this.sysType = arguments[0];
  this.partCount = 0;
  this.s0 = [];
  this.s0dot = [];
  this.s1 = [];
  this.f0 = [];
  this.limits = [];

  // simulation settings
  this.runMode = 0;	// particle system state: 0=reset; 1= pause; 2=step; 3=run
  this.FSIZE = Float32Array.BYTES_PER_ELEMENT;  // 'float' size, in bytes.

  if (arguments.length > 1)
    var count = arguments[1];
  switch(arguments[0]) {
    case SYS_NONE:
      this.sysType = SYS_NONE;
      break;
    case SYS_BOUNCY2D:
      this.initBouncy2D(count);
      break;
    case SYS_BOUNCY3D:
      this.initBouncy3D(count);
      break;
    case SYS_FIRE_REEVES:
      this.initFireReeves(count);
      break;
    case SYS_TORNADO:
      this.initTornado(count);
      break;
    case SYS_FLOCKING:
      this.initFlocking(count);
      break;
    case SYS_SPRING_PAIR:
      this.initSpringPair();
      break;
    case SYS_SPRING_ROPE:
      this.initSpringRope(count);
      break;
    case SYS_SPRING_CLOTH:
      this.initSpringCloth(arguments[1], arguments[2]);
      break;
    case SYS_SPRING_SOLID:
      this.initSpringSolid();
      break;
    case SYS_ORBITS:
      this.initSpringSolid();
      break;
    case SYS_GROUND_GRID:
      this.initGroundGrid(arguments[1], arguments[2]);
      break;
    default:
      this.sysType = SYS_NONE;
      console.log('PartSys error: could not find sysType=' + arguments[0]);
      break;
  }
  this.initVBO();
}

// Create & fill VBO with state var s0 contents:
PartSys.prototype.initVBO = function() {

    // Create a vertex buffer object (VBO) in the graphics hardware: get its ID#
    this.vboID = gl.createBuffer();
    if (!this.vboID) {
      console.log('PartSys.init() Failed to create the VBO object in the GPU');
      return -1;
    }
    // "Bind the new buffer object (memory in the graphics system) to target"
    // In other words, specify the usage of one selected buffer object.
    // What's a "Target"? it's the poorly-chosen OpenGL/WebGL name for the
    // intended use of this buffer's memory; so far, we have just two choices:
    //	== "gl.ARRAY_BUFFER" meaning the buffer object holds actual values we
    //      need for rendering (positions, colors, normals, etc), or
    //	== "gl.ELEMENT_ARRAY_BUFFER" meaning the buffer object holds indices
    // 			into a list of values we need; indices such as object #s, face #s,
    //			edge vertex #s.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboID);

    // Write data from our JavaScript array to graphics systems' buffer object:
    gl.bufferData(gl.ARRAY_BUFFER, this.getVBO(this.s0), gl.DYNAMIC_DRAW);

    // ---------Set up all attributes for VBO contents:
    //Get the ID# for the a_Position variable in the graphics hardware
    this.a_PositionID = gl.getAttribLocation(gl.program, 'a_Position');
    if(this.a_PositionID < 0) {
      console.log('PartSys.init() Failed to get the storage location of a_Position');
      return -1;
    }
    // Tell GLSL to fill the 'a_Position' attribute variable for each shader
    // with values from the buffer object chosen by 'gl.bindBuffer()' command.
    gl.vertexAttribPointer(this.a_PositionID,
            4,  // # of values in this attrib (1,2,3,4)
            gl.FLOAT, // data type (usually gl.FLOAT)
            false,    // use integer normalizing? (usually false)
            PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
            PART_XPOS * this.FSIZE); // Offset; #bytes from start of buffer to
                                     // 1st stored attrib value we will actually use.
    // Enable this assignment of the bound buffer to the a_Position variable:
    gl.enableVertexAttribArray(this.a_PositionID);

    this.a_ColorID = gl.getAttribLocation(gl.program, 'a_Color');
    if(this.a_ColorID < 0) {
      console.log('PartSys.init() Failed to get the storage location of a_Color');
      return -1;
    }
    // Tell GLSL to fill the 'a_Position' attribute variable for each shader
    // with values from the buffer object chosen by 'gl.bindBuffer()' command.
    gl.vertexAttribPointer(this.a_ColorID,
            3,  // # of values in this attrib (1,2,3)
            gl.FLOAT, // data type (usually gl.FLOAT)
            false,    // use integer normalizing? (usually false)
            PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
            PART_R * this.FSIZE); // Offset; #bytes from start of buffer to 1st stored attrib value.
    // Enable this assignment of the bound buffer to the a_Position variable:
    gl.enableVertexAttribArray(this.a_ColorID);

    this.a_PointSizeID = gl.getAttribLocation(gl.program, 'a_PointSize');
    if(this.a_PointSizeID < 0) {
      console.log('PartSys.init() Failed to get the storage location of a_PointSize');
      return -1;
    }
    // Tell GLSL to fill the 'a_Position' attribute variable for each shader
    // with values from the buffer object chosen by 'gl.bindBuffer()' command.
    gl.vertexAttribPointer(this.a_PointSize,
            1,  // # of values in this attrib (1,2,3)
            gl.FLOAT, // data type (usually gl.FLOAT)
            false,    // use integer normalizing? (usually false)
            PART_MAXVAR*this.FSIZE,  // Stride: #bytes from 1st stored value to next one
            PART_DIAM * this.FSIZE); // Offset; #bytes from start of buffer to 1st stored attrib value.
    // Enable this assignment of the bound buffer to the a_Position variable:
    gl.enableVertexAttribArray(this.a_PointSizeID);

    // ---------Set up all uniforms we send to the GPU:

}

// INIT FUNCTIONS:
//==================

PartSys.prototype.initGroundGrid = function(xSiz, zSiz) {
  this.xSize = xSiz;
  this.zSize = zSiz;
  this.partCount = (xSiz)+(zSiz);
  this.solvType = SOLV_SYMPLECTIC;
  this.initArrays(this.partCount);

	// First, step thru x values as we make vertical lines of constant-x:
	for(let i=0; i<this.partCount; i++) {
		if (i%4==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			this.s0[i][PART_XPOS] = (-xSiz + (i-0.0))*0.1;
			this.s0[i][PART_ZPOS] = -zSiz*0.1;
		}
		else if (i%4==1) {				// put odd-numbered vertices at (xnow, +xymax, 0).
			this.s0[i][PART_XPOS] = (-xSiz + (i-1.0))*0.1;
			this.s0[i][PART_ZPOS] = zSiz*0.1;
		}
    else if (i%4==2) {		// put even-numbered vertices at (-xzmax, znow, 0)
      this.s0[i][PART_XPOS] = -xSiz*0.1;
      this.s0[i][PART_ZPOS] = (-zSiz + (i-2.0))*0.1;
    }
    else {					// put odd-numbered vertices at (+xzmax, znow, 0).
      this.s0[i][PART_XPOS] = xSiz*0.1;
      this.s0[i][PART_ZPOS] = (-zSiz + (i-3.0))*0.1;
    }
    this.s0[i][PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.s0[i][PART_R] = 1.0;
    this.s0[i][PART_G] = 1.0;
    this.s0[i][PART_B] = 0.3;
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
	}
}

PartSys.prototype.initBouncy2D = function(count) {
  this.partCount = count;
  this.initArrays(count);
  this.solvType = SOLV_SYMPLECTIC;
  this.INIT_VEL = 0.15 * 60.0;
  this.drag = new CForcer(F_DRAG, 0.5);
  this.f0.push(this.drag);
  this.grav = new CForcer(F_GRAV_E, 9.807);  // gravity's acceleration; adjust by g/G keys
  this.f0.push(this.grav);
  this.limits.push(new CLimit(WTYPE_XWALL_LO, -0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_XWALL_HI, 0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_YWALL_LO, -0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_YWALL_HI, 0.9, 1.0, false));

  // INITIALIZE s0, s1:
  for(var i = 0; i < this.partCount; i++) {
    this.s0[i][PART_XPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_YPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_XVEL] = (2 * Math.random() - 1) * g_partA.INIT_VEL;
    this.s0[i][PART_YVEL] = (2 * Math.random() - 1) * g_partA.INIT_VEL;
    this.s0[i][PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.s0[i][PART_MASS] =  1.0;      // mass, in kg.
    this.s0[i][PART_DIAM] =  12.0;      // on-screen diameter, in pixels
    // //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}

PartSys.prototype.initBouncy3D = function(count) {
  this.partCount = count;
  this.initArrays(count);
  this.solvType = SOLV_SYMPLECTIC;
  this.INIT_VEL = 0.15 * 60.0; // in m/s
  this.drag = new CForcer(F_DRAG, 0.5);
  this.f0.push(this.drag);
  this.grav = new CForcer(F_GRAV_E, 9.807);
  this.f0.push(this.grav);
  this.limits.push(new CLimit(WTYPE_XWALL_LO, -0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_XWALL_HI, 0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_YWALL_LO, -0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_YWALL_HI, 0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_ZWALL_LO, -0.9, 1.0, false));
  this.limits.push(new CLimit(WTYPE_ZWALL_HI, 0.9, 1.0, false));

  // INITIALIZE s0, s1:
  for(var i = 0; i < this.partCount; i++) {
    this.s0[i][PART_XPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_YPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_ZPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_XVEL] = (2 * Math.random() - 1) * this.INIT_VEL;
    this.s0[i][PART_YVEL] = (2 * Math.random() - 1) * this.INIT_VEL;
    this.s0[i][PART_ZVEL] = (2 * Math.random() - 1) * this.INIT_VEL;
    this.s0[i][PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.s0[i][PART_MASS] =  1.0;      // mass, in kg.
    this.s0[i][PART_DIAM] =  12.0;      // on-screen diameter, in pixels
    // //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}

PartSys.prototype.initFireReeves = function(count) {
  this.partCount = count;
  this.initArrays(count);
  this.solvType = SOLV_VERLET;
  this.f0.push(new CForcer(F_GRAV_E, 0.1));
  this.limits.push(new CLimit(WTYPE_AGE, 2.0, 2.0));

  for(var i = 0; i < this.partCount; i++) {
    this.s0[i][PART_XPOS] = Math.random() / 4;
    this.s0[i][PART_ZPOS] = Math.random() / 4;
    this.s0[i][PART_XVEL] = Math.random() / 2;
    this.s0[i][PART_YVEL] = Math.random() + 1;
    this.s0[i][PART_ZVEL] = Math.random() / 2;
    this.s0[i][PART_WPOS] = 1.0;
    this.s0[i][PART_MASS] = 1.0;
    this.s0[i][PART_DIAM] = 6.0;
    this.s0[i][PART_AGE] = Math.random();
    this.s0[i][PART_R] = 28.0;
    this.s0[i][PART_G] = 0.5;
    //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}

PartSys.prototype.initTornado = function(count) {
  this.partCount = count;
  this.initArrays(count);
  this.solvType = SOLV_VERLET;
  var func = function(x,y,z) {
    let dist = Math.sqrt(x**2 + z**2);
    let height = 2;
    let force = 2 - Math.log(dist + 1) + y/height*2;
    let angle = Math.atan(z/x);
    return [-force*z, Math.random()-0.5, force*x];
  }
  this.f0.push(new CForcer(F_WIND, func));
  this.limits.push(new CLimit(WTYPE_AGE, 3.5, 0));

  for(var i = 0; i < this.partCount; i++) {
    this.s0[i][PART_XPOS] = (Math.random()-0.5)/8;
    this.s0[i][PART_ZPOS] = (Math.random()-0.5)/8;
    let dist = Math.sqrt(this.s0[i][PART_XPOS]**2 + this.s0[i][PART_ZPOS]**2);
    this.s0[i][PART_XVEL] = 0.0
    this.s0[i][PART_YVEL] = 1.0;
    this.s0[i][PART_ZVEL] = 0.0;
    this.s0[i][PART_WPOS] = 1.0;
    this.s0[i][PART_MASS] = 1.0;
    this.s0[i][PART_DIAM] = 6.0;
    this.s0[i][PART_R] = 237/256;
    this.s0[i][PART_G] = 221/256;
    this.s0[i][PART_B] = 225/256;
    this.s0[i][PART_AGE] = 3.5 * Math.random();
    //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}
PartSys.prototype.initFlocking = function(count) {
  this.partCount = count;
  this.initArrays(count);
  this.solvType = SOLV_VERLET;
  this.INIT_VEL = 1.0; // in m/s
  this.targetpos = [0.0, 0.0, 0.0];
  this.f0.push(new CForcer(F_DRAG, 1.2));
  this.f0.push(new CForcer(F_ALIGN, 3.0)); // alignment
  this.f0.push(new CForcer(F_BUBBLE, 1.0, 0, 4.0)); // attract to center?
  this.f0.push(new CForcer(F_BUBBLE, 1.0, 1, 4.0)); // attract to center?
  //this.f0.push(new CForcer(F_GRAV_P, -1.2, 1)); // evasion?
  this.f0.push(new CForcer(F_GRAV_P, -1.2, 2)); // evasion?
  this.f0.push(new CForcer(F_GRAV_P, -1.2, 3)); // evasion?
  this.limits.push(new CLimit(WTYPE_ANCHOR, [0, 1, 2, 3]));

  for(var i = 0; i < this.partCount; i++) {
    this.f0.push(new CForcer(F_GRAV_P, -0.1, i)); // separation
    this.f0.push(new CForcer(F_BUBBLE, 0.1, i, 0.1)); // cohesion

    this.s0[i][PART_XPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_YPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_ZPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_XVEL] = (2 * Math.random() - 1) * this.INIT_VEL;
    this.s0[i][PART_YVEL] = (2 * Math.random() - 1) * this.INIT_VEL;
    this.s0[i][PART_ZVEL] = (2 * Math.random() - 1) * this.INIT_VEL;
    this.s0[i][PART_R]    = 0.3 + 0.7 * Math.random();//0.5 + 0.5 * Math.random();
    this.s0[i][PART_G]    = 0.5;0.3 + 0.7 * Math.random();
    this.s0[i][PART_B]    = 0.3 + 0.7 * Math.random();// + 0.5 * Math.random();
    this.s0[i][PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.s0[i][PART_MASS] =  1.0;      // mass, in kg.
    this.s0[i][PART_DIAM] =  6.0;      // on-screen diameter, in pixels
    // //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}
PartSys.prototype.initSpringPair = function() {
  this.partCount = 2;
  this.initArrays(2);
  this.solvType = SOLV_VERLET;
  this.INIT_VEL = 0.5;
  this.f0.push(new CForcer(F_DRAG, 0));
  this.f0.push(new CForcer(F_SPRING, 100, 2.0, 0, 1));

  for(var i = 0; i < this.partCount; i++) {
    this.s0[i][PART_XPOS] = i%2==0 ? -0.5 : 0.5;
    this.s0[i][PART_YPOS] = Math.random() * 1.8 - 0.9;
    this.s0[i][PART_XVEL] = 0.0;
    this.s0[i][PART_YVEL] = 0.0;
    this.s0[i][PART_WPOS] =  1.0;      // position 'w' coordinate;
    this.s0[i][PART_MASS] =  1.0;      // mass, in kg.
    this.s0[i][PART_DIAM] =  15.0;      // on-screen diameter, in pixels
    // //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}
PartSys.prototype.initSpringRope = function(count) {
//==============================================================================
  console.log('PartSys.initSpringRope() stub not finished!');
}
PartSys.prototype.initSpringCloth = function(xSiz,ySiz) {
  this.xSize = xSiz;
  this.ySize = ySiz;
  this.density = 0.1;
  this.partCount = (xSiz+1)*(ySiz+1);
  this.initArrays(this.partCount);
  this.solvType = SOLV_VERLET;
  this.structural_springs = this.generateStructSprings(this.xSize, this.ySize);
  this.shear_springs = this.generateShearSprings(this.xSize, this.ySize);
  this.bending_springs = this.generateBendingSprings(this.xSize, this.ySize);
  this.shear_bending_springs = this.generateShearBendingSprings(this.xSize, this.ySize);
  this.limits.push(new CLimit(WTYPE_YWALL_LO, 0.0, 1.0, false));
  this.limits.push(new CLimit(WTYPE_ANCHOR, [ySiz*(xSiz+1), ySiz*(xSiz+1)+1, ySiz*(xSiz+1)+xSiz-1, ySiz*(xSiz+1)+xSiz]));
  this.f0.push(new CForcer(F_WIND, (x,y,z) => { return [Math.random()*10-5, Math.random()*10-5, Math.random()*10-5];} ));
  this.f0.push(new CForcer(F_GRAV_E, 2));
  this.f0.push(new CForcer(F_DRAG, 10));
  this.f0.push(new CForcer(F_SPRINGSET, 600, this.density, this.structural_springs)); // structural
  this.f0.push(new CForcer(F_SPRINGSET, 600, Math.sqrt(2*(this.density**2)), this.shear_springs)); // shear
  this.f0.push(new CForcer(F_SPRINGSET, 180, 2*this.density, this.bending_springs)); // bending
  this.f0.push(new CForcer(F_SPRINGSET, 180, 2*Math.sqrt(2*(this.density**2)), this.shear_bending_springs)); // bending


  for(var i = 0; i < this.partCount; i++) {
    this.s0[i][PART_XPOS] = this.density * (i % (this.xSize+1) - (this.xSize+1)/2);
    this.s0[i][PART_YPOS] = 1.0 + this.density * Math.floor(i/(this.xSize+1));
    this.s0[i][PART_WPOS] = 1.0;      // position 'w' coordinate;
    this.s0[i][PART_MASS] = 2.0;      // mass, in kg.
    this.s0[i][PART_R]    = 0.5 + 0.5 * Math.random();
    this.s0[i][PART_G]    = 0.5 + 0.5 * Math.random();
    this.s0[i][PART_B]    = 0.5 + 0.5 * Math.random();
    this.s0[i][PART_DIAM] = 5.0;      // on-screen diameter, in pixels
    // //----------------------------
    this.s1[i].setArray(this.s0[i].getArray());
    this.s2[i].setArray(this.s0[i].getArray());
  }
}
PartSys.prototype.initSpringSolid = function() {
//==============================================================================
  console.log('PartSys.initSpringSolid() stub not finished!');
}
PartSys.prototype.initOrbits = function() {
//==============================================================================
  console.log('PartSys.initOrbits() stub not finished!');
}

PartSys.prototype.applyForces = function(s, fSet) {
  // Clear the force-accumulator vector for each particle in state-vector 's',
  // then apply each force described in the collection of force-applying objects
  // found in 'fSet'.
  // (this function will simplify our too-complicated 'draw()' function)
  for(var i = 0; i < s.length; i++) {

    s[i][PART_X_FTOT] = 0.0;
    s[i][PART_Y_FTOT] = 0.0;
    s[i][PART_Z_FTOT] = 0.0;

    for (var j = 0; j < fSet.length; j++) {
      switch (fSet[j].forceType) {
        case F_NONE:
          break;
        case F_GRAV_E:
          s[i][PART_Y_FTOT] -= fSet[j].grav_e * s[i][PART_MASS];
          break;
        case F_GRAV_P:
          let k = fSet[j].point;
          if (k === i) continue;
          var dist = Math.sqrt(
            (s[i][PART_XPOS] - s[k][PART_XPOS])**2 +
            (s[i][PART_YPOS] - s[k][PART_YPOS])**2 +
            (s[i][PART_ZPOS] - s[k][PART_ZPOS])**2
          );
          s[i][PART_X_FTOT] += fSet[j].grav_p * s[i][PART_MASS] * s[k][PART_MASS] * (s[k][PART_XPOS] - s[i][PART_XPOS]) / dist**3;
          s[i][PART_Y_FTOT] += fSet[j].grav_p * s[i][PART_MASS] * s[k][PART_MASS] * (s[k][PART_YPOS] - s[i][PART_YPOS]) / dist**3;
          s[i][PART_Z_FTOT] += fSet[j].grav_p * s[i][PART_MASS] * s[k][PART_MASS] * (s[k][PART_ZPOS] - s[i][PART_ZPOS]) / dist**3;
          break;
        case F_WIND:
          [fx, fy, fz] = fSet[j].forceFunc(s[i][PART_XPOS], s[i][PART_YPOS], s[i][PART_ZPOS]);
          s[i][PART_X_FTOT] += fx;
          s[i][PART_Y_FTOT] += fy;
          s[i][PART_Z_FTOT] += fz;
          if (this.sysType === SYS_SPRING_CLOTH && Math.random() < 0.003 && Math.random() < 0.01) {
            console.log('changing wind');
            fSet[j].forceFunc = (x,y,z) => { return [Math.random()*10-5, Math.random()*10-5, Math.random()*10-5]};
          }
          break;
        case F_BUBBLE:
          let l = fSet[j].point;
          if (l === i) continue;
          var dist = Math.sqrt(
            (s[i][PART_XPOS] - s[l][PART_XPOS])**2 +
            (s[i][PART_YPOS] - s[l][PART_YPOS])**2 +
            (s[i][PART_ZPOS] - s[l][PART_ZPOS])**2
          );
          if (dist > fSet[j].bub_radius) {
            s[i][PART_X_FTOT] += fSet[j].bub_force * (s[l][PART_XPOS] - s[i][PART_XPOS]) / dist;
            s[i][PART_Y_FTOT] += fSet[j].bub_force * (s[l][PART_YPOS] - s[i][PART_YPOS]) / dist;
            s[i][PART_Z_FTOT] += fSet[j].bub_force * (s[l][PART_ZPOS] - s[i][PART_ZPOS]) / dist;
          }
          break;
        case F_DRAG:
          s[i][PART_X_FTOT] -= fSet[j].drag * s[i][PART_XVEL] * s[i][PART_MASS];
          s[i][PART_Y_FTOT] -= fSet[j].drag * s[i][PART_YVEL] * s[i][PART_MASS];
          s[i][PART_Z_FTOT] -= fSet[j].drag * s[i][PART_ZVEL] * s[i][PART_MASS];
          break;
        case F_SPRING:
          if (fSet[j].p0 == i || fSet[j].p1 == i) {
            var p0 = s[fSet[j].p0];
            var p1 = s[fSet[j].p1];
            var dist = Math.sqrt(
              (p1[PART_XPOS] - p0[PART_XPOS])**2 +
              (p1[PART_YPOS] - p0[PART_YPOS])**2 +
              (p1[PART_ZPOS] - p0[PART_ZPOS])**2
            );
            var spring_force = fSet[j].k_s * (dist - fSet[j].len_s);
            s[i][PART_X_FTOT] += (fSet[j].p0 == i ? 1 : -1) * spring_force * (p1[PART_XPOS] - p0[PART_XPOS]) / dist;
            s[i][PART_Y_FTOT] += (fSet[j].p0 == i ? 1 : -1) * spring_force * (p1[PART_YPOS] - p0[PART_YPOS]) / dist;
            s[i][PART_Z_FTOT] += (fSet[j].p0 == i ? 1 : -1) * spring_force * (p1[PART_ZPOS] - p0[PART_ZPOS]) / dist;
          }
          break;
        case F_SPRINGSET:
          for (let k = 0; k < fSet[j].pairs.length; k++) {
            if (fSet[j].pairs[k][0] == i || fSet[j].pairs[k][1] == i) {
              var p0 = fSet[j].pairs[k][0];
              var p1 = fSet[j].pairs[k][1];
              var dist = Math.sqrt(
                (s[p1][PART_XPOS] - s[p0][PART_XPOS])**2 +
                (s[p1][PART_YPOS] - s[p0][PART_YPOS])**2 +
                (s[p1][PART_ZPOS] - s[p0][PART_ZPOS])**2
              );
              var spring_force = fSet[j].k_s * (dist - fSet[j].len_s);
              s[i][PART_X_FTOT] += (p0 == i ? 1 : -1) * spring_force * (s[p1][PART_XPOS] - s[p0][PART_XPOS]) / dist;
              s[i][PART_Y_FTOT] += (p0 == i ? 1 : -1) * spring_force * (s[p1][PART_YPOS] - s[p0][PART_YPOS]) / dist;
              s[i][PART_Z_FTOT] += (p0 == i ? 1 : -1) * spring_force * (s[p1][PART_ZPOS] - s[p0][PART_ZPOS]) / dist;
            }
          }
          break;
        case F_ALIGN:
          let dir = [0.0, 0.0, 0.0];
          for (let m = 0; m < this.partCount; m++) {
            if (m === i) continue;
            var dist = Math.sqrt(
              (s[i][PART_XPOS] - s[m][PART_XPOS])**2 +
              (s[i][PART_YPOS] - s[m][PART_YPOS])**2 +
              (s[i][PART_ZPOS] - s[m][PART_ZPOS])**2
            );
            dir[0] += s[i][PART_XPOS] / dist**2;
            dir[1] += s[i][PART_YPOS] / dist**2;
            dir[2] += s[i][PART_ZPOS] / dist**2;
          }
          let len = Math.sqrt( dir[0]**2 + dir[1]**2 + dir[2]**2 );
          s[i][PART_X_FTOT] += fSet[j].force * dir[0] / len;
          s[i][PART_Y_FTOT] += fSet[j].force * dir[1] / len;
          s[i][PART_Z_FTOT] += fSet[j].force * dir[2] / len;
          break;
        default:
          console.log("error: could not find CForce type " + fSet[j].forceType);
          break;
      }
    }
  }
  return s;
}

PartSys.prototype.dotFinder = function(s, sdot) {
//==============================================================================
// fill the already-existing 's0dot' variable (a float32array) with the
// time-derivative of given state 's0'.

  for (var i = 0; i < s.length; i++) {
    sdot[i][PART_XPOS]   = s[i][PART_XVEL];
    sdot[i][PART_YPOS]   = s[i][PART_YVEL];
    sdot[i][PART_ZPOS]   = s[i][PART_ZVEL];
    sdot[i][PART_WPOS]   = 0.0; // assume constant
    sdot[i][PART_XVEL]   = s[i][PART_X_FTOT] / s[i][PART_MASS];
    sdot[i][PART_YVEL]   = s[i][PART_Y_FTOT] / s[i][PART_MASS];
    sdot[i][PART_ZVEL]   = s[i][PART_Z_FTOT] / s[i][PART_MASS];
    sdot[i][PART_X_FTOT] = 0.0; // assume constant
    sdot[i][PART_Y_FTOT] = 0.0; // assume constant
    sdot[i][PART_Z_FTOT] = 0.0; // assume constant
    sdot[i][PART_R]      = 0.0; // assume constant
    sdot[i][PART_G]      = 0.0; // assume constant
    sdot[i][PART_B]      = 0.0; // assume constant
    sdot[i][PART_MASS]   = 0.0; // assume constant
    sdot[i][PART_DIAM]   = 0.0; // assume constant
    sdot[i][PART_RENDMODE] = 0.0; // assume constant
    sdot[i][PART_AGE] = 1.0; // assume constant

    if (this.sysType === SYS_FIRE_REEVES) {
      sdot[i][PART_G] = 1.0;
      sdot[i][PART_DIAM] = -1.5;
    }
  }
}

PartSys.prototype.render = function() {
//==============================================================================
// Draw the contents of state-vector 's' on-screen. To do this:
//  a) transfer its contents to the already-existing VBO in the GPU using the
//      WebGL call 'gl.bufferSubData()', then
//  b) set all the 'uniform' values needed by our shaders,
//  c) draw VBO contents using gl.drawArray().

  gl.bufferSubData(
          gl.ARRAY_BUFFER,  // specify the 'binding target': either
                  //    gl.ARRAY_BUFFER (VBO holding sets of vertex attribs)
                  // or gl.ELEMENT_ARRAY_BUFFER (VBO holding vertex-index values)
          0,      // offset: # of bytes to skip at the start of the VBO before
                    // we begin data replacement.
          this.getVBO(this.s0)); // Float32Array data source.

  // Draw our VBO's new contents:
  //var primitive = (this.sysType == SYS_GROUND_GRID) ? gl.LINES: gl.POINTS;
  //gl.drawArrays(primitive,          // mode: WebGL drawing primitive to use
   //             0,                  // index: start at this vertex in the VBO;
    //            this.partCount);    // draw this many vertices.
  if (this.sysType == SYS_GROUND_GRID) {
    gl.drawArrays(gl.LINES, 0, this.partCount);
  } else {
	  gl.drawArrays(gl.POINTS, 0, this.partCount);
  }
}

PartSys.prototype.solver = function() {
//==============================================================================
// Find next state s1 from current state s0 (and perhaps some related states
// such as s0dot, sM, sMdot, etc.) by the numerical integration method chosen
// by PartSys.solvType.

// applyForces and get s0dot
this.applyForces(this.s0, this.f0);
this.dotFinder(this.s0, this.s0dot);

let h = g_timeStep * 0.001;

for(var i = 0; i < this.partCount; i++) {

  // forward euler for all non-velocty elements
  for (let j = 10; j < PART_MAXVAR; j++) {
    this.s1[i][j] += this.s0dot[i][j] * h;
  }

  switch(this.solvType)
  {
    case SOLV_EULER:
      this.s1[i][PART_XPOS] += this.s0dot[i][PART_XPOS] * h;
      this.s1[i][PART_YPOS] += this.s0dot[i][PART_YPOS] * h;
      this.s1[i][PART_ZPOS] += this.s0dot[i][PART_ZPOS] * h;
      this.s1[i][PART_XVEL] += this.s0dot[i][PART_XVEL] * h;
      this.s1[i][PART_YVEL] += this.s0dot[i][PART_YVEL] * h;
      this.s1[i][PART_ZVEL] += this.s0dot[i][PART_ZVEL] * h;
      break;

    case SOLV_MIDPOINT:
      // calculate sM, using forward euler for h/2
      this.s2[i][PART_XPOS] = this.s1[i][PART_XPOS] + this.s0dot[i][PART_XPOS] * h / 2;
      this.s2[i][PART_YPOS] = this.s1[i][PART_YPOS] + this.s0dot[i][PART_YPOS] * h / 2;
      this.s2[i][PART_ZPOS] = this.s1[i][PART_ZPOS] + this.s0dot[i][PART_ZPOS] * h / 2;
      this.s2[i][PART_XVEL] = this.s1[i][PART_XVEL] + this.s0dot[i][PART_XVEL] * h / 2;
      this.s2[i][PART_YVEL] = this.s1[i][PART_YVEL] + this.s0dot[i][PART_YVEL] * h / 2;
      this.s2[i][PART_ZVEL] = this.s1[i][PART_ZVEL] + this.s0dot[i][PART_ZVEL] * h / 2;
      // calculate sMdot
      this.applyForces(this.s2[i], this.f0);
      // now apply forward euler using sMdot.
      this.s1[i][PART_XPOS] += this.s2[i][PART_XVEL] * h;
      this.s1[i][PART_YPOS] += this.s2[i][PART_YVEL] * h;
      this.s1[i][PART_ZPOS] += this.s2[i][PART_ZVEL] * h;
      this.s1[i][PART_XVEL] += this.s2[i][PART_X_FTOT] / this.s1[i][PART_MASS] * h;
      this.s1[i][PART_YVEL] += this.s2[i][PART_Y_FTOT] / this.s1[i][PART_MASS] * h;
      this.s1[i][PART_ZVEL] += this.s2[i][PART_Z_FTOT] / this.s1[i][PART_MASS] * h;
      break;

    case SOLV_SYMPLECTIC:
      this.s1[i][PART_XVEL] += this.s0dot[i][PART_XVEL] * h;
      this.s1[i][PART_YVEL] += this.s0dot[i][PART_YVEL] * h;
      this.s1[i][PART_ZVEL] += this.s0dot[i][PART_ZVEL] * h;
      this.s1[i][PART_XPOS] += this.s1[i][PART_XVEL] * h;
      this.s1[i][PART_YPOS] += this.s1[i][PART_YVEL] * h;
      this.s1[i][PART_ZPOS] += this.s1[i][PART_ZVEL] * h;
      break;

    case SOLV_VERLET:
      // calculate previous position
      this.s2[i][PART_XPOS] = this.s0[i][PART_XPOS] - this.s0dot[i][PART_XPOS] * h;
      this.s2[i][PART_YPOS] = this.s0[i][PART_YPOS] - this.s0dot[i][PART_YPOS] * h;
      this.s2[i][PART_ZPOS] = this.s0[i][PART_ZPOS] - this.s0dot[i][PART_ZPOS] * h;
      this.s1[i][PART_XPOS] = 2 * this.s0[i][PART_XPOS] - this.s2[i][PART_XPOS] + this.s0dot[i][PART_XVEL] * (h**2);
      this.s1[i][PART_YPOS] = 2 * this.s0[i][PART_YPOS] - this.s2[i][PART_YPOS] + this.s0dot[i][PART_YVEL] * (h**2);
      this.s1[i][PART_ZPOS] = 2 * this.s0[i][PART_ZPOS] - this.s2[i][PART_ZPOS] + this.s0dot[i][PART_ZVEL] * (h**2);

      // update velocities
      this.s1[i][PART_XVEL] += this.s0dot[i][PART_XVEL] * h;
      this.s1[i][PART_YVEL] += this.s0dot[i][PART_YVEL] * h;
      this.s1[i][PART_ZVEL] += this.s0dot[i][PART_ZVEL] * h;
      break;

    case SOLV_BACK_EULER:
      // calculate initial s1
      this.s1[i][PART_XPOS] = this.s0[i][PART_XPOS] + this.s0dot[i][PART_XPOS] * h;
      this.s1[i][PART_YPOS] = this.s0[i][PART_YPOS] + this.s0dot[i][PART_YPOS] * h;
      this.s1[i][PART_ZPOS] = this.s0[i][PART_ZPOS] + this.s0dot[i][PART_ZPOS] * h;
      this.s1[i][PART_XVEL] = this.s0[i][PART_XVEL] + this.s0dot[i][PART_XVEL] * h;
      this.s1[i][PART_YVEL] = this.s0[i][PART_YVEL] + this.s0dot[i][PART_YVEL] * h;
      this.s1[i][PART_ZVEL] = this.s0[i][PART_ZVEL] + this.s0dot[i][PART_ZVEL] * h;

      for (let j=0; j < 1; j++) {
        // calculate s1dot
        this.applyForces(this.s1[i], this.f0);
        this.dotFinder(this.s1[i], this.s1dot[i]);
        // find back euler estimation s2
        this.s2[i][PART_XPOS] = this.s1[i][PART_XPOS] - this.s1dot[i][PART_XPOS] * h;
        this.s2[i][PART_YPOS] = this.s1[i][PART_YPOS] - this.s1dot[i][PART_YPOS] * h;
        this.s2[i][PART_ZPOS] = this.s1[i][PART_ZPOS] - this.s1dot[i][PART_ZPOS] * h;
        this.s2[i][PART_XVEL] = this.s1[i][PART_XVEL] - this.s1dot[i][PART_XVEL] * h;
        this.s2[i][PART_YVEL] = this.s1[i][PART_YVEL] - this.s1dot[i][PART_YVEL] * h;
        this.s2[i][PART_ZVEL] = this.s1[i][PART_ZVEL] - this.s1dot[i][PART_ZVEL] * h;
        // find residue sErr
        this.sErr[i][PART_XPOS] = this.s0[i][PART_XPOS] - this.s2[i][PART_XPOS];
        this.sErr[i][PART_YPOS] = this.s0[i][PART_YPOS] - this.s2[i][PART_YPOS];
        this.sErr[i][PART_ZPOS] = this.s0[i][PART_ZPOS] - this.s2[i][PART_ZPOS];
        this.sErr[i][PART_XVEL] = this.s0[i][PART_XVEL] - this.s2[i][PART_XVEL];
        this.sErr[i][PART_YVEL] = this.s0[i][PART_YVEL] - this.s2[i][PART_YVEL];
        this.sErr[i][PART_ZVEL] = this.s0[i][PART_ZVEL] - this.s2[i][PART_ZVEL];
        // correct half the error
        this.s1[i][PART_XPOS] += this.sErr[i][PART_XPOS] / 1.5;
        this.s1[i][PART_YPOS] += this.sErr[i][PART_YPOS] / 1.5;
        this.s1[i][PART_ZPOS] += this.sErr[i][PART_ZPOS] / 1.5;
        this.s1[i][PART_XVEL] += this.sErr[i][PART_XVEL] / 1.5;
        this.s1[i][PART_YVEL] += this.sErr[i][PART_YVEL] / 1.5;
        this.s1[i][PART_ZVEL] += this.sErr[i][PART_ZVEL] / 1.5;
      }
      break;
    default:
      console.log('?!?! unknown solver: this.solvType==' + this.solvType);
      break;
    }
  }
  // Now apply constraints
  this.doConstraints();
  this.swap(); // replace s0 (current state) with s1 (next state)

  return;
}

// apply all constraints to s1:
PartSys.prototype.doConstraints = function() {
  for (var i = 0; i < this.partCount; i++) {
    for (var j = 0; j < this.limits.length; j++) {
      let lim = this.limits[j];
      switch (lim.limitType) {
        case WTYPE_DEAD:
          break;
        case WTYPE_XWALL_LO: // collision! left wall...
          if (this.s1[i][PART_XPOS] < lim.pos && this.s1[i][PART_XVEL] < 0.0) {
            this.s1[i][PART_XPOS] = lim.pos;
            this.s1[i][PART_XVEL] *= this.s1[i][PART_XVEL] > 0.0 ? lim.resti : -lim.resti;
          }
          break;
        case WTYPE_XWALL_HI: // right wall
          if (this.s1[i][PART_XPOS] > lim.pos && this.s1[i][PART_XVEL] > 0.0) {
            this.s1[i][PART_XPOS] = lim.pos;
            this.s1[i][PART_XVEL] *= this.s1[i][PART_XVEL] < 0.0 ? lim.resti : -lim.resti;
          }
          break;
        case WTYPE_YWALL_LO:  // floor
          if (this.s1[i][PART_YPOS] < lim.pos && this.s1[i][PART_YVEL] < 0.0) {
            this.s1[i][PART_YPOS] = lim.pos;
            if (this.grav) {
              this.s1[i][PART_YVEL] += this.grav.grav_e * (g_timeStep * 0.001);
            }
            this.s1[i][PART_YVEL] *= this.s1[i][PART_YVEL] > 0.0 ? lim.resti : -lim.resti;
          }
          break;
        case WTYPE_YWALL_HI: // ceiling
          if (this.s1[i][PART_YPOS] > lim.pos && this.s1[i][PART_YVEL] > 0.0) {
            this.s1[i][PART_YPOS] = lim.pos;
            this.s1[i][PART_YVEL] *= this.s1[i][PART_YVEL] < 0.0 ? lim.resti : -lim.resti;
          }
          break;
        case WTYPE_ZWALL_LO:
          if (this.s1[i][PART_ZPOS] < lim.pos && this.s1[i][PART_ZVEL] < 0.0) {
            this.s1[i][PART_ZPOS] = lim.pos;
            this.s1[i][PART_ZVEL] *= this.s1[i][PART_ZVEL] > 0.0 ? lim.resti : -lim.resti;
          }
          break;
        case WTYPE_ZWALL_HI:
          if (this.s1[i][PART_ZPOS] > lim.pos && this.s1[i][PART_ZVEL] > 0.0) {
            this.s1[i][PART_ZPOS] = lim.pos;
            this.s1[i][PART_ZVEL] *= this.s1[i][PART_ZVEL] < 0.0 ? lim.resti : -lim.resti;
          }
          break;
        case WTYPE_ANCHOR:
          if (lim.points.includes(i)) {
            this.s1[i][PART_XPOS] = this.s0[i][PART_XPOS];
            this.s1[i][PART_YPOS] = this.s0[i][PART_YPOS];
            this.s1[i][PART_ZPOS] = this.s0[i][PART_ZPOS];
            this.s1[i][PART_XVEL] = 0.0;
            this.s1[i][PART_YVEL] = 0.0;
            this.s1[i][PART_ZVEL] = 0.0;
            if (this.sysType === SYS_FLOCKING && Math.random() < 0.01) {
              console.log('change of predators');
              this.s1[i][PART_XPOS] = 2 * (Math.random() - 0.5);
              this.s1[i][PART_YPOS] = 2 * (Math.random() - 0.5);
              this.s1[i][PART_ZPOS] = 2 * (Math.random() - 0.5);
            }
          }

          break;
        case WTYPE_AGE:
          if ( this.s1[i][PART_AGE] > lim.mean + lim.variance * (Math.random() - 0.5) ) {
            if (this.sysType === SYS_FIRE_REEVES) {
              this.s1[i][PART_XPOS] = Math.random() / 4;
              this.s1[i][PART_ZPOS] = Math.random() / 4;
              this.s1[i][PART_YPOS] = 0.0;
              this.s1[i][PART_XVEL] = Math.random() / 2;
              this.s1[i][PART_YVEL] = Math.random() + 1;
              this.s1[i][PART_ZVEL] = Math.random() / 2;
              this.s1[i][PART_AGE] = 0.0;
              this.s1[i][PART_R] = 28.0;
              this.s1[i][PART_G] = 0.5;
              this.s1[i][PART_DIAM] = 6.0;
            }
            else if (this.sysType === SYS_TORNADO) {
              this.s1[i][PART_XPOS] = (Math.random()-0.5)/8;
              this.s1[i][PART_YPOS] = 0.0;
              this.s1[i][PART_ZPOS] = (Math.random()-0.5)/8;
              let dist = Math.sqrt(this.s1[i][PART_XPOS]**2 + this.s1[i][PART_ZPOS]**2);
              this.s1[i][PART_XVEL] = 0.0;// Math.random() - 0.5;
              this.s1[i][PART_YVEL] = 1.0;
              this.s1[i][PART_ZVEL] = 0.0;//Math.random() - 0.5;
              this.s1[i][PART_AGE] = 0.0;
            }

          }
          break;
        default:
          console.log('unkown constraint: CLimit type ' + this.limits[j].limitType)
          break;
      }
    }
  }

}

// Exchange contents of state-vector s0, s1.
PartSys.prototype.swap = function() {
  for (let i = 0; i < this.s0.length; i++) {
    this.s0[i].setArray(this.s1[i].getArray());
  }
}

PartSys.prototype.getVBO = function(s) {
  var vbo = new Float32Array(s.length*PART_MAXVAR);
  for (let i=0; i<s.length; i+=1) {
    vbo.set(s[i].getArray(), i*PART_MAXVAR);
  }
  return vbo;
}

PartSys.prototype.initArrays = function(count) {
  this.s0 = [];
  this.s1 = [];
  this.s2 = [];
  this.s0dot= [];
  this.s1dot = [];
  this.sErr = [];
  this.tmp = [];
  for (var i = 0; i < count; i++) {
    this.s0.push(new CPart());
    this.s1.push(new CPart());
    this.s2.push(new CPart());
    this.s0dot.push(new CPart());
    this.s1dot.push(new CPart());
    this.sErr.push(new CPart());
    this.tmp.push(new CPart());
  }
}

PartSys.prototype.generateStructSprings = function(xSiz, ySiz) {
  let pairs = [];
  for (let j = 0; j < ySiz+1; j++) {
    for (let i = 0; i < xSiz; i++) {
      pairs.push([i+j*(xSiz+1), i+j*(xSiz+1)+1]);
    }
  }
  for (let j = 0; j < ySiz; j++) {
    for (let i = 0; i < xSiz+1; i++) {
      pairs.push([i+j*(xSiz+1), i+(j+1)*(xSiz+1)]);
    }
  }
  return pairs;
}

PartSys.prototype.generateShearSprings = function(xSiz, ySiz) {
  let pairs = [];
  for (let j = 0; j < ySiz; j++) {
    for (let i = 0; i < xSiz; i++)
      pairs.push([i+j*(xSiz+1), i+(j+1)*(xSiz+1)+1]);
    for (let i = 1; i < xSiz+1; i++)
      pairs.push([i+j*(xSiz+1), i+(j+1)*(xSiz+1)-1]);
  }
  return pairs;
}

PartSys.prototype.generateBendingSprings = function(xSiz, ySiz) {
  let pairs = [];
  for (let j = 0; j < ySiz+1; j++) {
    for (let i = 0; i < xSiz-1; i++) {
      pairs.push([i+j*(xSiz+1), i+j*(xSiz+1)+2]);
    }
  }
  for (let j = 0; j < ySiz-1; j++) {
    for (let i = 0; i < xSiz+1; i++) {
      pairs.push([i+j*(xSiz+1), i+(j+2)*(xSiz+1)]);
    }
  }
  return pairs;
}

PartSys.prototype.generateShearBendingSprings = function(xSiz, ySiz) {
  let pairs = [];
  for (let j = 0; j < ySiz-1; j++) {
    for (let i = 0; i < xSiz-1; i++)
      pairs.push([i+j*(xSiz+1), i+(j+2)*(xSiz+1)+2]);
    for (let i = 2; i < xSiz+1; i++)
      pairs.push([i+j*(xSiz+1), i+(j+2)*(xSiz+1)-2]);
  }
  return pairs;
}
