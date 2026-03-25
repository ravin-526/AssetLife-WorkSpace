class User {
  final String id;
  final String role;
  final String? name;
  final String? email;
  final String? mobile;
  
  User({
    required this.id,
    required this.role,
    this.name,
    this.email,
    this.mobile,
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      role: json['role']?.toString() ?? 'individual',
      name: json['name'],
      email: json['email'],
      mobile: json['mobile'] ?? json['phone'],
    );
  }
}

class AuthResponse {
  final String accessToken;
  final String tokenType;
  final int expiresIn;
  final User user;
  
  AuthResponse({
    required this.accessToken,
    required this.tokenType,
    required this.expiresIn,
    required this.user,
  });
  
  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['access_token'] ?? '',
      tokenType: json['token_type'] ?? 'bearer',
      expiresIn: json['expires_in'] ?? 3600,
      user: User.fromJson(json['user'] ?? {}),
    );
  }
}
