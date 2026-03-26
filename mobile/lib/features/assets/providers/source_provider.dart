import 'package:flutter/material.dart';
import '../../../shared/services/source_service.dart';

class SourceProvider extends ChangeNotifier {
  final SourceService _sourceService;
  List<String> _sources = [];

  SourceProvider(this._sourceService) {
    _sources = _sourceService.getSources();
  }

  List<String> get sources => _sources;
}
